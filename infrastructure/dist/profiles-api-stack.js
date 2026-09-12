"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilesApiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ecsPatterns = __importStar(require("aws-cdk-lib/aws-ecs-patterns"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const ecrAssets = __importStar(require("aws-cdk-lib/aws-ecr-assets"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const path = __importStar(require("path"));
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
];
class ProfilesApiStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const vpc = props?.vpc ?? ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });
        // Build Docker image from app (context: monorepo root relative to infra)
        const appPath = path.join(__dirname, '../..', 'apps/profiles-api');
        const image = new ecrAssets.DockerImageAsset(this, 'ProfilesApiImage', {
            directory: appPath,
            file: 'Dockerfile',
            exclude: ['node_modules', 'dist', '.git'],
        });
        // Resolve secrets from Secrets Manager if provided
        let appSecret;
        const containerSecrets = {};
        if (props?.secretsArn ?? props?.secretsName) {
            appSecret = props.secretsArn
                ? secretsmanager.Secret.fromSecretCompleteArn(this, 'AppSecrets', props.secretsArn)
                : secretsmanager.Secret.fromSecretNameV2(this, 'AppSecrets', props.secretsName);
            for (const key of SECRET_KEYS) {
                containerSecrets[key] = ecs.Secret.fromSecretsManager(appSecret, key);
            }
        }
        // TLS termination at the ALB. The certificate is built from domainName, but
        // domainName is deliberately not handed to the L3 construct below: that
        // pairing requires a Route53 `domainZone`, and this zone is hosted on Vercel.
        let certificate;
        if (props?.domainName) {
            certificate = props.certificateArn
                ? acm.Certificate.fromCertificateArn(this, 'ApiCertificate', props.certificateArn)
                : new acm.Certificate(this, 'ApiCertificate', {
                    domainName: props.domainName,
                    validation: acm.CertificateValidation.fromDns(),
                });
        }
        // Application Load Balancer + Fargate
        const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ProfilesApiService', {
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
        });
        // Grant task execution role read access to secrets
        if (appSecret && fargateService.taskDefinition.executionRole) {
            appSecret.grantRead(fargateService.taskDefinition.executionRole);
        }
        // Enable public IP so Fargate task can reach Secrets Manager over the internet
        // (required when running in public subnets without NAT Gateway)
        const cfnService = fargateService.service.node.defaultChild;
        cfnService.addPropertyOverride('NetworkConfiguration.AwsvpcConfiguration.AssignPublicIp', 'ENABLED');
        // Health check on ALB
        fargateService.targetGroup.configureHealthCheck({
            path: '/health',
            healthyHttpCodes: '200',
            interval: cdk.Duration.seconds(30),
            timeout: cdk.Duration.seconds(5),
        });
        // Security group: allow inbound 80/443 from ALB (handled by default)
        // Add CORS origins to task env if needed
        // Output: URL
        new cdk.CfnOutput(this, 'LoadBalancerDNS', {
            value: fargateService.loadBalancer.loadBalancerDnsName,
            description: 'ALB DNS name for Profiles API — CNAME target for the custom domain',
            exportName: 'ProfilesApiAlbDns',
        });
        new cdk.CfnOutput(this, 'ServiceURL', {
            value: props?.domainName
                ? `https://${props.domainName}`
                : `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
            description: 'Value to set as PROFILES_API_URL in the CRM Vercel project',
            exportName: 'ProfilesApiUrl',
        });
    }
}
exports.ProfilesApiStack = ProfilesApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZmlsZXMtYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3Byb2ZpbGVzLWFwaS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBa0M7QUFDbEMsd0VBQXlEO0FBQ3pELHlEQUEwQztBQUMxQyx5REFBMEM7QUFDMUMsMEVBQTJEO0FBQzNELDhFQUErRDtBQUMvRCxzRUFBdUQ7QUFDdkQsK0VBQWdFO0FBRWhFLDJDQUE0QjtBQUU1Qiw4REFBOEQ7QUFDOUQsTUFBTSxXQUFXLEdBQUc7SUFDbEIsY0FBYztJQUNkLDJCQUEyQjtJQUMzQixtQkFBbUI7SUFDbkIsWUFBWTtJQUNaLG9CQUFvQjtJQUNwQixlQUFlO0lBQ2YsbUJBQW1CO0lBQ25CLHVCQUF1QjtDQUNmLENBQUE7QUFvQ1YsTUFBYSxnQkFBaUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM3QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTZCO1FBQ3JFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFBO1FBRXZCLE1BQU0sR0FBRyxHQUFHLEtBQUssRUFBRSxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFBO1FBRXJGLHlFQUF5RTtRQUN6RSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLENBQUMsQ0FBQTtRQUNsRSxNQUFNLEtBQUssR0FBRyxJQUFJLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDckUsU0FBUyxFQUFFLE9BQU87WUFDbEIsSUFBSSxFQUFFLFlBQVk7WUFDbEIsT0FBTyxFQUFFLENBQUMsY0FBYyxF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Z0JBQWdCO1NBQzdCLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQW5IRCw0Q0FtSEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInXG5pbXBvcnQgKiBhcyBhY20gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNlcnRpZmljYXRlbWFuYWdlcidcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJ1xuaW1wb3J0ICogYXMgZWNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MnXG5pbXBvcnQgKiBhcyBlY3NQYXR0ZXJucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNzLXBhdHRlcm5zJ1xuaW1wb3J0ICogYXMgZWxidjIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNsb2FkYmFsYW5jaW5ndjInXG5pbXBvcnQgKiBhcyBlY3JBc3NldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjci1hc3NldHMnXG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJ1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJ1xuXG4vKiogS2V5cyBleHBlY3RlZCBpbiB0aGUgYXBwIHNlY3JldHMgSlNPTiAoU2VjcmV0cyBNYW5hZ2VyKSAqL1xuY29uc3QgU0VDUkVUX0tFWVMgPSBbXG4gICdTVVBBQkFTRV9VUkwnLFxuICAnU1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWScsXG4gICdTVVBBQkFTRV9BTk9OX0tFWScsXG4gICdKV1RfU0VDUkVUJyxcbiAgJ0FXU19TM19CVUNLRVRfTkFNRScsXG4gICdBV1NfUzNfUkVHSU9OJyxcbiAgJ0FXU19BQ0NFU1NfS0VZX0lEJyxcbiAgJ0FXU19TRUNSRVRfQUNDRVNTX0tFWScsXG5dIGFzIGNvbnN0XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvZmlsZXNBcGlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKipcbiAgICogT3B0aW9uYWw6IGV4aXN0aW5nIFZQQy4gSWYgbm90IHByb3ZpZGVkLCBkZWZhdWx0IFZQQyBpcyB1c2VkLlxuICAgKi9cbiAgdnBjPzogZWMyLklWcGNcbiAgLyoqXG4gICAqIEZ1bGwgQVJOIG9mIFNlY3JldHMgTWFuYWdlciBzZWNyZXQgKG11c3QgaW5jbHVkZSA2LWNoYXIgc3VmZml4LCBlLmcuIC4uLi02WWR6aVUpLlxuICAgKiBBbHRlcm5hdGl2ZTogdXNlIHNlY3JldHNOYW1lIGluc3RlYWQuXG4gICAqL1xuICBzZWNyZXRzQXJuPzogc3RyaW5nXG4gIC8qKlxuICAgKiBTZWNyZXQgbmFtZSAoZS5nLiBwYXNoa292c2t5LXByb2ZpbGVzLWFwaS1zZWNyZXRzKS4gVXNlIHdoZW4gQVJOIHN1ZmZpeCBpcyB1bmtub3duLlxuICAgKiBTZWNyZXQgbXVzdCBleGlzdCBpbiB0aGUgc2FtZSByZWdpb24gYXMgdGhlIHN0YWNrLlxuICAgKi9cbiAgc2VjcmV0c05hbWU/OiBzdHJpbmdcbiAgLyoqXG4gICAqIEhvc3RuYW1lIGNsaWVudHMgdXNlIHRvIHJlYWNoIHRoZSBBUEksIGUuZy4gcHJvZmlsZXMtYXBpLnBhc2hrb3Zza3ktZ3JvdXAuY29tLlxuICAgKlxuICAgKiBXaGVuIHNldCwgdGhlIEFMQiBzZXJ2ZXMgSFRUUFMgb24gNDQzIGFuZCByZWRpcmVjdHMgODAgLT4gNDQzLiBUaGUgRE5TIHJlY29yZFxuICAgKiBpdHNlbGYgaXMgTk9UIGNyZWF0ZWQgaGVyZTogdGhlIHpvbmUgbGl2ZXMgaW4gVmVyY2VsIEROUywgbm90IFJvdXRlNTMsIHNvIGFcbiAgICogQ05BTUUgZnJvbSB0aGlzIGhvc3RuYW1lIHRvIHRoZSBBTEIgbXVzdCBiZSBhZGRlZCB0aGVyZSBieSBoYW5kLlxuICAgKlxuICAgKiBXaGVuIG9taXR0ZWQgdGhlIEFMQiBzdGF5cyBIVFRQLW9ubHksIHdoaWNoIGlzIG9ubHkgYXBwcm9wcmlhdGUgZm9yIHNjcmF0Y2hcbiAgICogZW52aXJvbm1lbnRzIOKAlCBDUk0gZm9yd2FyZHMgY2FsbGVyIEpXVHMgdXBzdHJlYW0sIHNvIHBsYWludGV4dCBleHBvc2VzIHRoZW0uXG4gICAqL1xuICBkb21haW5OYW1lPzogc3RyaW5nXG4gIC8qKlxuICAgKiBFeGlzdGluZyBBQ00gY2VydGlmaWNhdGUgZm9yIGBkb21haW5OYW1lYC4gV2hlbiBvbWl0dGVkIGEgY2VydGlmaWNhdGUgaXNcbiAgICogY3JlYXRlZCB3aXRoIEROUyB2YWxpZGF0aW9uLCBhbmQgYGNkayBkZXBsb3lgIGJsb2NrcyB1bnRpbCB0aGUgdmFsaWRhdGlvblxuICAgKiBDTkFNRSBzaG93biBpbiB0aGUgQ2xvdWRGb3JtYXRpb24gZXZlbnRzIGlzIGFkZGVkIHRvIFZlcmNlbCBETlMuXG4gICAqL1xuICBjZXJ0aWZpY2F0ZUFybj86IHN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgUHJvZmlsZXNBcGlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogUHJvZmlsZXNBcGlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcylcblxuICAgIGNvbnN0IHZwYyA9IHByb3BzPy52cGMgPz8gZWMyLlZwYy5mcm9tTG9va3VwKHRoaXMsICdEZWZhdWx0VnBjJywgeyBpc0RlZmF1bHQ6IHRydWUgfSlcblxuICAgIC8vIEJ1aWxkIERvY2tlciBpbWFnZSBmcm9tIGFwcCAoY29udGV4dDogbW9ub3JlcG8gcm9vdCByZWxhdGl2ZSB0byBpbmZyYSlcbiAgICBjb25zdCBhcHBQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uJywgJ2FwcHMvcHJvZmlsZXMtYXBpJylcbiAgICBjb25zdCBpbWFnZSA9IG5ldyBlY3JBc3NldHMuRG9ja2VySW1hZ2VBc3NldCh0aGlzLCAnUHJvZmlsZXNBcGlJbWFnZScsIHtcbiAgICAgIGRpcmVjdG9yeTogYXBwUGF0aCxcbiAgICAgIGZpbGU6ICdEb2NrZXJmaWxlJyxcbiAgICAgIGV4Y2x1ZGU6IFsnbm9kZV9tb2R1bGVzJywgJ2Rpc3QnLCAnLmdpdCddLFxuICAgIH0pXG5cbiAgICAvLyBSZXNvbHZlIHNlY3JldHMgZnJvbSBTZWNyZXRzIE1hbmFnZXIgaWYgcHJvdmlkZWRcbiAgICBsZXQgYXBwU2VjcmV0OiBzZWNyZXRzbWFuYWdlci5JU2VjcmV0IHwgdW5kZWZpbmVkXG4gICAgY29uc3QgY29udGFpbmVyU2VjcmV0czogUmVjb3JkPHN0cmluZywgZWNzLlNlY3JldD4gPSB7fVxuICAgIGlmIChwcm9wcz8uc2VjcmV0c0FybiA/PyBwcm9wcz8uc2VjcmV0c05hbWUpIHtcbiAgICAgIGFwcFNlY3JldCA9IHByb3BzLnNlY3JldHNBcm5cbiAgICAgICAgPyBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldENvbXBsZXRlQXJuKHRoaXMsICdBcHBTZWNyZXRzJywgcHJvcHMuc2VjcmV0c0FybilcbiAgICAgICAgOiBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMih0aGlzLCAnQXBwU2VjcmV0cycsIHByb3BzLnNlY3JldHNOYW1lISlcbiAgICAgIGZvciAoY29uc3Qga2V5IG9mIFNFQ1JFVF9LRVlTKSB7XG4gICAgICAgIGNvbnRhaW5lclNlY3JldHNba2V5XSA9IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKGFwcFNlY3JldCEsIGtleSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBUTFMgdGVybWluYXRpb24gYXQgdGhlIEFMQi4gVGhlIGNlcnRpZmljYXRlIGlzIGJ1aWx0IGZyb20gZG9tYWluTmFtZSwgYnV0XG4gICAgLy8gZG9tYWluTmFtZSBpcyBkZWxpYmVyYXRlbHkgbm90IGhhbmRlZCB0byB0aGUgTDMgY29uc3RydWN0IGJlbG93OiB0aGF0XG4gICAgLy8gcGFpcmluZyByZXF1aXJlcyBhIFJvdXRlNTMgYGRvbWFpblpvbmVgLCBhbmQgdGhpcyB6b25lIGlzIGhvc3RlZCBvbiBWZXJjZWwuXG4gICAgbGV0IGNlcnRpZmljYXRlOiBhY20uSUNlcnRpZmljYXRlIHwgdW5kZWZpbmVkXG4gICAgaWYgKHByb3BzPy5kb21haW5OYW1lKSB7XG4gICAgICBjZXJ0aWZpY2F0ZSA9IHByb3BzLmNlcnRpZmljYXRlQXJuXG4gICAgICAgID8gYWNtLkNlcnRpZmljYXRlLmZyb21DZXJ0aWZpY2F0ZUFybih0aGlzLCAnQXBpQ2VydGlmaWNhdGUnLCBwcm9wcy5jZXJ0aWZpY2F0ZUFybilcbiAgICAgICAgOiBuZXcgYWNtLkNlcnRpZmljYXRlKHRoaXMsICdBcGlDZXJ0aWZpY2F0ZScsIHtcbiAgICAgICAgICAgIGRvbWFpbk5hbWU6IHByb3BzLmRvbWFpbk5hbWUsXG4gICAgICAgICAgICB2YWxpZGF0aW9uOiBhY20uQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnMoKSxcbiAgICAgICAgICB9KVxuICAgIH1cblxuICAgIC8vIEFwcGxpY2F0aW9uIExvYWQgQmFsYW5jZXIgKyBGYXJnYXRlXG4gICAgY29uc3QgZmFyZ2F0ZVNlcnZpY2UgPSBuZXcgZWNzUGF0dGVybnMuQXBwbGljYXRpb25Mb2FkQmFsYW5jZWRGYXJnYXRlU2VydmljZShcbiAgICAgIHRoaXMsXG4gICAgICAnUHJvZmlsZXNBcGlTZXJ2aWNlJyxcbiAgICAgIHtcbiAgICAgICAgdnBjLFxuICAgICAgICBzZXJ2aWNlTmFtZTogJ3Byb2ZpbGVzLWFwaScsXG4gICAgICAgIC4uLihjZXJ0aWZpY2F0ZVxuICAgICAgICAgID8ge1xuICAgICAgICAgICAgICBjZXJ0aWZpY2F0ZSxcbiAgICAgICAgICAgICAgcHJvdG9jb2w6IGVsYnYyLkFwcGxpY2F0aW9uUHJvdG9jb2wuSFRUUFMsXG4gICAgICAgICAgICAgIHNzbFBvbGljeTogZWxidjIuU3NsUG9saWN5LlJFQ09NTUVOREVEX1RMUyxcbiAgICAgICAgICAgICAgcmVkaXJlY3RIVFRQOiB0cnVlLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIDoge30pLFxuICAgICAgICB0YXNrSW1hZ2VPcHRpb25zOiB7XG4gICAgICAgICAgaW1hZ2U6IGVjcy5Db250YWluZXJJbWFnZS5mcm9tRG9ja2VySW1hZ2VBc3NldChpbWFnZSksXG4gICAgICAgICAgY29udGFpbmVyUG9ydDogMzAwMixcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgTk9ERV9FTlY6ICdwcm9kdWN0aW9uJyxcbiAgICAgICAgICAgIFBPUlQ6ICczMDAyJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNlY3JldHM6IE9iamVjdC5rZXlzKGNvbnRhaW5lclNlY3JldHMpLmxlbmd0aCA+IDAgPyBjb250YWluZXJTZWNyZXRzIDogdW5kZWZpbmVkLFxuICAgICAgICAgIGxvZ0RyaXZlcjogZWNzLkxvZ0RyaXZlcnMuYXdzTG9ncyh7XG4gICAgICAgICAgICBzdHJlYW1QcmVmaXg6ICdwcm9maWxlcy1hcGknLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgICBjcHU6IDI1NixcbiAgICAgICAgbWVtb3J5TGltaXRNaUI6IDUxMixcbiAgICAgICAgZGVzaXJlZENvdW50OiAxLFxuICAgICAgICBtaW5IZWFsdGh5UGVyY2VudDogMCxcbiAgICAgICAgbWF4SGVhbHRoeVBlcmNlbnQ6IDIwMCxcbiAgICAgICAgcHVibGljTG9hZEJhbGFuY2VyOiB0cnVlLFxuICAgICAgICBoZWFsdGhDaGVja0dyYWNlUGVyaW9kOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICB9XG4gICAgKVxuXG4gICAgLy8gR3JhbnQgdGFzayBleGVjdXRpb24gcm9sZSByZWFkIGFjY2VzcyB0byBzZWNyZXRzXG4gICAgaWYgKGFwcFNlY3JldCAmJiBmYXJnYXRlU2VydmljZS50YXNrRGVmaW5pdGlvbi5leGVjdXRpb25Sb2xlKSB7XG4gICAgICBhcHBTZWNyZXQuZ3JhbnRSZWFkKGZhcmdhdGVTZXJ2aWNlLnRhc2tEZWZpbml0aW9uLmV4ZWN1dGlvblJvbGUpXG4gICAgfVxuXG4gICAgLy8gRW5hYmxlIHB1YmxpYyBJUCBzbyBGYXJnYXRlIHRhc2sgY2FuIHJlYWNoIFNlY3JldHMgTWFuYWdlciBvdmVyIHRoZSBpbnRlcm5ldFxuICAgIC8vIChyZXF1aXJlZCB3aGVuIHJ1bm5pbmcgaW4gcHVibGljIHN1Ym5ldHMgd2l0aG91dCBOQVQgR2F0ZXdheSlcbiAgICBjb25zdCBjZm5TZXJ2aWNlID0gZmFyZ2F0ZVNlcnZpY2Uuc2VydmljZS5ub2RlLmRlZmF1bHRDaGlsZCBhcyBlY3MuQ2ZuU2VydmljZVxuICAgIGNmblNlcnZpY2UuYWRkUHJvcGVydHlPdmVycmlkZShcbiAgICAgICdOZXR3b3JrQ29uZmlndXJhdGlvbi5Bd3N2cGNDb25maWd1cmF0aW9uLkFzc2lnblB1YmxpY0lwJyxcbiAgICAgICdFTkFCTEVEJ1xuICAgIClcblxuICAgIC8vIEhlYWx0aCBjaGVjayBvbiBBTEJcbiAgICBmYXJnYXRlU2VydmljZS50YXJnZXRHcm91cC5jb25maWd1cmVIZWFsdGhDaGVjayh7XG4gICAgICBwYXRoOiAnL2hlYWx0aCcsXG4gICAgICBoZWFsdGh5SHR0cENvZGVzOiAnMjAwJyxcbiAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcbiAgICB9KVxuXG4gICAgLy8gU2VjdXJpdHkgZ3JvdXA6IGFsbG93IGluYm91bmQgODAvNDQzIGZyb20gQUxCIChoYW5kbGVkIGJ5IGRlZmF1bHQpXG4gICAgLy8gQWRkIENPUlMgb3JpZ2lucyB0byB0YXNrIGVudiBpZiBuZWVkZWRcblxuICAgIC8vIE91dHB1dDogVVJMXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xvYWRCYWxhbmNlckROUycsIHtcbiAgICAgIHZhbHVlOiBmYXJnYXRlU2VydmljZS5sb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQUxCIEROUyBuYW1lIGZvciBQcm9maWxlcyBBUEkg4oCUIENOQU1FIHRhcmdldCBmb3IgdGhlIGN1c3RvbSBkb21haW4nLFxuICAgICAgZXhwb3J0TmFtZTogJ1Byb2ZpbGVzQXBpQWxiRG5zJyxcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NlcnZpY2VVUkwnLCB7XG4gICAgICB2YWx1ZTogcHJvcHM/LmRvbWFpbk5hbWVcbiAgICAgICAgPyBgaHR0cHM6Ly8ke3Byb3BzLmRvbWFpbk5hbWV9YFxuICAgICAgICA6IGBodHRwOi8vJHtmYXJnYXRlU2VydmljZS5sb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdWYWx1ZSB0byBzZXQgYXMgUFJPRklMRVNfQVBJX1VSTCBpbiB0aGUgQ1JNIFZlcmNlbCBwcm9qZWN0JyxcbiAgICAgIGV4cG9ydE5hbWU6ICdQcm9maWxlc0FwaVVybCcsXG4gICAgfSlcbiAgfVxufVxuIl19