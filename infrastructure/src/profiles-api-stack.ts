import * as cdk from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'
import * as path from 'path'

/** Keys expected in the app secrets JSON (Secrets Manager) */
const SECRET_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET',
  'AWS_S3_BUCKET_NAME',
  'AWS_S3_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
] as const

export interface ProfilesApiStackProps extends cdk.StackProps {
  /**
   * Optional: existing VPC. If not provided, default VPC is used.
   */
  vpc?: ec2.IVpc
  /**
   * Full ARN of Secrets Manager secret (must include 6-char suffix, e.g. ...-6YdziU).
   * Alternative: use secretsName instead.
   */
  secretsArn?: string
  /**
   * Secret name (e.g. pashkovsky-profiles-api-secrets). Use when ARN suffix is unknown.
   * Secret must exist in the same region as the stack.
   */
  secretsName?: string
  /**
   * Hostname clients use to reach the API, e.g. profiles-api.pashkovsky-group.com.
   *
   * When set, the ALB serves HTTPS on 443 and redirects 80 -> 443. The DNS record
   * itself is NOT created here: the zone lives in Vercel DNS, not Route53, so a
   * CNAME from this hostname to the ALB must be added there by hand.
   *
   * When omitted the ALB stays HTTP-only, which is only appropriate for scratch
   * environments — CRM forwards caller JWTs upstream, so plaintext exposes them.
   */
  domainName?: string
  /**
   * Existing ACM certificate for `domainName`. When omitted a certificate is
   * created with DNS validation, and `cdk deploy` blocks until the validation
   * CNAME shown in the CloudFormation events is added to Vercel DNS.
   */
  certificateArn?: string
}

export class ProfilesApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ProfilesApiStackProps) {
    super(scope, id, props)

    const vpc = props?.vpc ?? ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true })

    // Build Docker image from app (context: monorepo root relative to infra)
    const appPath = path.join(__dirname, '../..', 'apps/profiles-api')
    const image = new ecrAssets.DockerImageAsset(this, 'ProfilesApiImage', {
      directory: appPath,
      file: 'Dockerfile',
      exclude: ['node_modules', 'dist', '.git'],
    })

    // Resolve secrets from Secrets Manager if provided
    let appSecret: secretsmanager.ISecret | undefined
    const containerSecrets: Record<string, ecs.Secret> = {}
    if (props?.secretsArn ?? props?.secretsName) {
      appSecret = props.secretsArn
        ? secretsmanager.Secret.fromSecretCompleteArn(this, 'AppSecrets', props.secretsArn)
        : secretsmanager.Secret.fromSecretNameV2(this, 'AppSecrets', props.secretsName!)
      for (const key of SECRET_KEYS) {
        containerSecrets[key] = ecs.Secret.fromSecretsManager(appSecret!, key)
      }
    }

    // TLS termination at the ALB. The certificate is built from domainName, but
    // domainName is deliberately not handed to the L3 construct below: that
    // pairing requires a Route53 `domainZone`, and this zone is hosted on Vercel.
    let certificate: acm.ICertificate | undefined
    if (props?.domainName) {
      certificate = props.certificateArn
        ? acm.Certificate.fromCertificateArn(this, 'ApiCertificate', props.certificateArn)
        : new acm.Certificate(this, 'ApiCertificate', {
            domainName: props.domainName,
            validation: acm.CertificateValidation.fromDns(),
          })
    }

    // Application Load Balancer + Fargate
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'ProfilesApiService',
      {
        vpc,
        serviceName: 'profiles-api',
        ...(certificate
          ? {
              certificate,
              protocol: elbv2.ApplicationProtocol.HTTPS,
              sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
              redirectHTTP: true,
            }
          : {}),
        taskImageOptions: {
          image: ecs.ContainerImage.fromDockerImageAsset(image),
          containerPort: 3002,
          environment: {
            NODE_ENV: 'production',
            PORT: '3002',
          },
          secrets: Object.keys(containerSecrets).length > 0 ? containerSecrets : undefined,
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'profiles-api',
          }),
        },
        cpu: 256,
        memoryLimitMiB: 512,
        desiredCount: 1,
        minHealthyPercent: 0,
        maxHealthyPercent: 200,
        publicLoadBalancer: true,
        healthCheckGracePeriod: cdk.Duration.seconds(60),
      }
    )

    // Grant task execution role read access to secrets
    if (appSecret && fargateService.taskDefinition.executionRole) {
      appSecret.grantRead(fargateService.taskDefinition.executionRole)
    }

    // Enable public IP so Fargate task can reach Secrets Manager over the internet
    // (required when running in public subnets without NAT Gateway)
    const cfnService = fargateService.service.node.defaultChild as ecs.CfnService
    cfnService.addPropertyOverride(
      'NetworkConfiguration.AwsvpcConfiguration.AssignPublicIp',
      'ENABLED'
    )

    // Health check on ALB
    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
    })

    // Security group: allow inbound 80/443 from ALB (handled by default)
    // Add CORS origins to task env if needed

    // Output: URL
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'ALB DNS name for Profiles API — CNAME target for the custom domain',
      exportName: 'ProfilesApiAlbDns',
    })

    new cdk.CfnOutput(this, 'ServiceURL', {
      value: props?.domainName
        ? `https://${props.domainName}`
        : `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
      description: 'Value to set as PROFILES_API_URL in the CRM Vercel project',
      exportName: 'ProfilesApiUrl',
    })
  }
}
