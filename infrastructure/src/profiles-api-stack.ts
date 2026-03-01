import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
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
  'PASHKOVSKY_COMPANY_ID',
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

    // Application Load Balancer + Fargate
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'ProfilesApiService',
      {
        vpc,
        serviceName: 'profiles-api',
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
      description: 'ALB DNS name for Profiles API',
      exportName: 'ProfilesApiAlbDns',
    })

    new cdk.CfnOutput(this, 'ServiceURL', {
      value: `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
      description: 'Profiles API URL (use HTTPS with ACM certificate for production)',
      exportName: 'ProfilesApiUrl',
    })
  }
}
