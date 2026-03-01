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
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ecsPatterns = __importStar(require("aws-cdk-lib/aws-ecs-patterns"));
const ecrAssets = __importStar(require("aws-cdk-lib/aws-ecr-assets"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const path = __importStar(require("path"));
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
        // Application Load Balancer + Fargate
        const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ProfilesApiService', {
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
            description: 'ALB DNS name for Profiles API',
            exportName: 'ProfilesApiAlbDns',
        });
        new cdk.CfnOutput(this, 'ServiceURL', {
            value: `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
            description: 'Profiles API URL (use HTTPS with ACM certificate for production)',
            exportName: 'ProfilesApiUrl',
        });
    }
}
exports.ProfilesApiStack = ProfilesApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZmlsZXMtYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3Byb2ZpbGVzLWFwaS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBa0M7QUFDbEMseURBQTBDO0FBQzFDLHlEQUEwQztBQUMxQywwRUFBMkQ7QUFDM0Qsc0VBQXVEO0FBQ3ZELCtFQUFnRTtBQUVoRSwyQ0FBNEI7QUFFNUIsOERBQThEO0FBQzlELE1BQU0sV0FBVyxHQUFHO0lBQ2xCLGNBQWM7SUFDZCwyQkFBMkI7SUFDM0IsbUJBQW1CO0lBQ25CLFlBQVk7SUFDWix1QkFBdUI7SUFDdkIsb0JBQW9CO0lBQ3BCLGVBQWU7SUFDZixtQkFBbUI7SUFDbkIsdUJBQXVCO0NBQ2YsQ0FBQTtBQW1CVixNQUFhLGdCQUFpQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzdDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBNkI7UUFDckUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFFdkIsTUFBTSxHQUFHLEdBQUcsS0FBSyxFQUFFLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUE7UUFFckYseUVBQXlFO1FBQ3pFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsQ0FBQyxDQUFBO1FBQ2xFLE1BQU0sS0FBSyxHQUFHLElBQUksU0FBUyxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUNyRSxTQUFTLEVBQUUsT0FBTztZQUNsQixJQUFJLEVBQUUsWUFBWTtZQUNsQixPQUFPLEVBQUUsQ0FBQyxjQUFjLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQztTQUMxQyxDQUFDLENBQUE7UUFFRixtREFBbUQ7UUFDbkQsSUFBSSxTQUE2QyxDQUFBO1FBQ2pELE1BQU0sZ0JBQWdCLEdBQStCLEVBQUUsQ0FBQTtRQUN2RCxJQUFJLEtBQUssRUFBRSxVQUFVLElBQUksS0FBSyxFQUFFLFdBQVcsRUFBRSxDQUFDO1lBQzVDLFNBQVMsR0FBRyxLQUFLLENBQUMsVUFBVTtnQkFDMUIsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDO2dCQUNuRixDQUFDLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLEtBQUssQ0FBQyxXQUFZLENBQUMsQ0FBQTtZQUNsRixLQUFLLE1BQU0sR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUM5QixnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLFNBQVUsRUFBRSxHQUFHLENBQUMsQ0FBQTtZQUN4RSxDQUFDO1FBQ0gsQ0FBQztRQUVELHNDQUFzQztRQUN0QyxNQUFNLGNBQWMsR0FBRyxJQUFJLFdBQVcsQ0FBQyxxQ0FBcUMsQ0FDMUUsSUFBSSxFQUNKLG9CQUFvQixFQUNwQjtZQUNFLEdBQUc7WUFDSCxXQUFXLEVBQUUsY0FBYztZQUMzQixnQkFBZ0IsRUFBRTtnQkFDaEIsS0FBSyxFQUFFLEdBQUcsQ0FBQyxjQUFjLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDO2dCQUNyRCxhQUFhLEVBQUUsSUFBSTtnQkFDbkIsV0FBVyxFQUFFO29CQUNYLFFBQVEsRUFBRSxZQUFZO29CQUN0QixJQUFJLEVBQUUsTUFBTTtpQkFDYjtnQkFDRCxPQUFPLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxTQUFTO2dCQUNoRixTQUFTLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7b0JBQ2hDLFlBQVksRUFBRSxjQUFjO2lCQUM3QixDQUFDO2FBQ0g7WUFDRCxHQUFHLEVBQUUsR0FBRztZQUNSLGNBQWMsRUFBRSxHQUFHO1lBQ25CLFlBQVksRUFBRSxDQUFDO1lBQ2YsaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixpQkFBaUIsRUFBRSxHQUFHO1lBQ3RCLGtCQUFrQixFQUFFLElBQUk7WUFDeEIsc0JBQXNCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1NBQ2pELENBQ0YsQ0FBQTtRQUVELG1EQUFtRDtRQUNuRCxJQUFJLFNBQVMsSUFBSSxjQUFjLENBQUMsY0FBYyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQzdELFNBQVMsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsQ0FBQTtRQUNsRSxDQUFDO1FBRUQsK0VBQStFO1FBQy9FLGdFQUFnRTtRQUNoRSxNQUFNLFVBQVUsR0FBRyxjQUFjLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUE4QixDQUFBO1FBQzdFLFVBQVUsQ0FBQyxtQkFBbUIsQ0FDNUIseURBQXlELEVBQ3pELFNBQVMsQ0FDVixDQUFBO1FBRUQsc0JBQXNCO1FBQ3RCLGNBQWMsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUM7WUFDOUMsSUFBSSxFQUFFLFNBQVM7WUFDZixnQkFBZ0IsRUFBRSxLQUFLO1lBQ3ZCLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDbEMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUNqQyxDQUFDLENBQUE7UUFFRixxRUFBcUU7UUFDckUseUNBQXlDO1FBRXpDLGNBQWM7UUFDZCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxjQUFjLENBQUMsWUFBWSxDQUFDLG1CQUFtQjtZQUN0RCxXQUFXLEVBQUUsK0JBQStCO1lBQzVDLFVBQVUsRUFBRSxtQkFBbUI7U0FDaEMsQ0FBQyxDQUFBO1FBRUYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLFVBQVUsY0FBYyxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsRUFBRTtZQUNsRSxXQUFXLEVBQUUsa0VBQWtFO1lBQy9FLFVBQVUsRUFBRSxnQkFBZ0I7U0FDN0IsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQUNGO0FBNUZELDRDQTRGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYidcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJ1xuaW1wb3J0ICogYXMgZWNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MnXG5pbXBvcnQgKiBhcyBlY3NQYXR0ZXJucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNzLXBhdHRlcm5zJ1xuaW1wb3J0ICogYXMgZWNyQXNzZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3ItYXNzZXRzJ1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJ1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cydcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCdcblxuLyoqIEtleXMgZXhwZWN0ZWQgaW4gdGhlIGFwcCBzZWNyZXRzIEpTT04gKFNlY3JldHMgTWFuYWdlcikgKi9cbmNvbnN0IFNFQ1JFVF9LRVlTID0gW1xuICAnU1VQQUJBU0VfVVJMJyxcbiAgJ1NVUEFCQVNFX1NFUlZJQ0VfUk9MRV9LRVknLFxuICAnU1VQQUJBU0VfQU5PTl9LRVknLFxuICAnSldUX1NFQ1JFVCcsXG4gICdQQVNIS09WU0tZX0NPTVBBTllfSUQnLFxuICAnQVdTX1MzX0JVQ0tFVF9OQU1FJyxcbiAgJ0FXU19TM19SRUdJT04nLFxuICAnQVdTX0FDQ0VTU19LRVlfSUQnLFxuICAnQVdTX1NFQ1JFVF9BQ0NFU1NfS0VZJyxcbl0gYXMgY29uc3RcblxuZXhwb3J0IGludGVyZmFjZSBQcm9maWxlc0FwaVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIC8qKlxuICAgKiBPcHRpb25hbDogZXhpc3RpbmcgVlBDLiBJZiBub3QgcHJvdmlkZWQsIGRlZmF1bHQgVlBDIGlzIHVzZWQuXG4gICAqL1xuICB2cGM/OiBlYzIuSVZwY1xuICAvKipcbiAgICogRnVsbCBBUk4gb2YgU2VjcmV0cyBNYW5hZ2VyIHNlY3JldCAobXVzdCBpbmNsdWRlIDYtY2hhciBzdWZmaXgsIGUuZy4gLi4uLTZZZHppVSkuXG4gICAqIEFsdGVybmF0aXZlOiB1c2Ugc2VjcmV0c05hbWUgaW5zdGVhZC5cbiAgICovXG4gIHNlY3JldHNBcm4/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFNlY3JldCBuYW1lIChlLmcuIHBhc2hrb3Zza3ktcHJvZmlsZXMtYXBpLXNlY3JldHMpLiBVc2Ugd2hlbiBBUk4gc3VmZml4IGlzIHVua25vd24uXG4gICAqIFNlY3JldCBtdXN0IGV4aXN0IGluIHRoZSBzYW1lIHJlZ2lvbiBhcyB0aGUgc3RhY2suXG4gICAqL1xuICBzZWNyZXRzTmFtZT86IHN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgUHJvZmlsZXNBcGlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogUHJvZmlsZXNBcGlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcylcblxuICAgIGNvbnN0IHZwYyA9IHByb3BzPy52cGMgPz8gZWMyLlZwYy5mcm9tTG9va3VwKHRoaXMsICdEZWZhdWx0VnBjJywgeyBpc0RlZmF1bHQ6IHRydWUgfSlcblxuICAgIC8vIEJ1aWxkIERvY2tlciBpbWFnZSBmcm9tIGFwcCAoY29udGV4dDogbW9ub3JlcG8gcm9vdCByZWxhdGl2ZSB0byBpbmZyYSlcbiAgICBjb25zdCBhcHBQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uJywgJ2FwcHMvcHJvZmlsZXMtYXBpJylcbiAgICBjb25zdCBpbWFnZSA9IG5ldyBlY3JBc3NldHMuRG9ja2VySW1hZ2VBc3NldCh0aGlzLCAnUHJvZmlsZXNBcGlJbWFnZScsIHtcbiAgICAgIGRpcmVjdG9yeTogYXBwUGF0aCxcbiAgICAgIGZpbGU6ICdEb2NrZXJmaWxlJyxcbiAgICAgIGV4Y2x1ZGU6IFsnbm9kZV9tb2R1bGVzJywgJ2Rpc3QnLCAnLmdpdCddLFxuICAgIH0pXG5cbiAgICAvLyBSZXNvbHZlIHNlY3JldHMgZnJvbSBTZWNyZXRzIE1hbmFnZXIgaWYgcHJvdmlkZWRcbiAgICBsZXQgYXBwU2VjcmV0OiBzZWNyZXRzbWFuYWdlci5JU2VjcmV0IHwgdW5kZWZpbmVkXG4gICAgY29uc3QgY29udGFpbmVyU2VjcmV0czogUmVjb3JkPHN0cmluZywgZWNzLlNlY3JldD4gPSB7fVxuICAgIGlmIChwcm9wcz8uc2VjcmV0c0FybiA/PyBwcm9wcz8uc2VjcmV0c05hbWUpIHtcbiAgICAgIGFwcFNlY3JldCA9IHByb3BzLnNlY3JldHNBcm5cbiAgICAgICAgPyBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldENvbXBsZXRlQXJuKHRoaXMsICdBcHBTZWNyZXRzJywgcHJvcHMuc2VjcmV0c0FybilcbiAgICAgICAgOiBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMih0aGlzLCAnQXBwU2VjcmV0cycsIHByb3BzLnNlY3JldHNOYW1lISlcbiAgICAgIGZvciAoY29uc3Qga2V5IG9mIFNFQ1JFVF9LRVlTKSB7XG4gICAgICAgIGNvbnRhaW5lclNlY3JldHNba2V5XSA9IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKGFwcFNlY3JldCEsIGtleSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyICsgRmFyZ2F0ZVxuICAgIGNvbnN0IGZhcmdhdGVTZXJ2aWNlID0gbmV3IGVjc1BhdHRlcm5zLkFwcGxpY2F0aW9uTG9hZEJhbGFuY2VkRmFyZ2F0ZVNlcnZpY2UoXG4gICAgICB0aGlzLFxuICAgICAgJ1Byb2ZpbGVzQXBpU2VydmljZScsXG4gICAgICB7XG4gICAgICAgIHZwYyxcbiAgICAgICAgc2VydmljZU5hbWU6ICdwcm9maWxlcy1hcGknLFxuICAgICAgICB0YXNrSW1hZ2VPcHRpb25zOiB7XG4gICAgICAgICAgaW1hZ2U6IGVjcy5Db250YWluZXJJbWFnZS5mcm9tRG9ja2VySW1hZ2VBc3NldChpbWFnZSksXG4gICAgICAgICAgY29udGFpbmVyUG9ydDogMzAwMixcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgTk9ERV9FTlY6ICdwcm9kdWN0aW9uJyxcbiAgICAgICAgICAgIFBPUlQ6ICczMDAyJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNlY3JldHM6IE9iamVjdC5rZXlzKGNvbnRhaW5lclNlY3JldHMpLmxlbmd0aCA+IDAgPyBjb250YWluZXJTZWNyZXRzIDogdW5kZWZpbmVkLFxuICAgICAgICAgIGxvZ0RyaXZlcjogZWNzLkxvZ0RyaXZlcnMuYXdzTG9ncyh7XG4gICAgICAgICAgICBzdHJlYW1QcmVmaXg6ICdwcm9maWxlcy1hcGknLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgICBjcHU6IDI1NixcbiAgICAgICAgbWVtb3J5TGltaXRNaUI6IDUxMixcbiAgICAgICAgZGVzaXJlZENvdW50OiAxLFxuICAgICAgICBtaW5IZWFsdGh5UGVyY2VudDogMCxcbiAgICAgICAgbWF4SGVhbHRoeVBlcmNlbnQ6IDIwMCxcbiAgICAgICAgcHVibGljTG9hZEJhbGFuY2VyOiB0cnVlLFxuICAgICAgICBoZWFsdGhDaGVja0dyYWNlUGVyaW9kOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICB9XG4gICAgKVxuXG4gICAgLy8gR3JhbnQgdGFzayBleGVjdXRpb24gcm9sZSByZWFkIGFjY2VzcyB0byBzZWNyZXRzXG4gICAgaWYgKGFwcFNlY3JldCAmJiBmYXJnYXRlU2VydmljZS50YXNrRGVmaW5pdGlvbi5leGVjdXRpb25Sb2xlKSB7XG4gICAgICBhcHBTZWNyZXQuZ3JhbnRSZWFkKGZhcmdhdGVTZXJ2aWNlLnRhc2tEZWZpbml0aW9uLmV4ZWN1dGlvblJvbGUpXG4gICAgfVxuXG4gICAgLy8gRW5hYmxlIHB1YmxpYyBJUCBzbyBGYXJnYXRlIHRhc2sgY2FuIHJlYWNoIFNlY3JldHMgTWFuYWdlciBvdmVyIHRoZSBpbnRlcm5ldFxuICAgIC8vIChyZXF1aXJlZCB3aGVuIHJ1bm5pbmcgaW4gcHVibGljIHN1Ym5ldHMgd2l0aG91dCBOQVQgR2F0ZXdheSlcbiAgICBjb25zdCBjZm5TZXJ2aWNlID0gZmFyZ2F0ZVNlcnZpY2Uuc2VydmljZS5ub2RlLmRlZmF1bHRDaGlsZCBhcyBlY3MuQ2ZuU2VydmljZVxuICAgIGNmblNlcnZpY2UuYWRkUHJvcGVydHlPdmVycmlkZShcbiAgICAgICdOZXR3b3JrQ29uZmlndXJhdGlvbi5Bd3N2cGNDb25maWd1cmF0aW9uLkFzc2lnblB1YmxpY0lwJyxcbiAgICAgICdFTkFCTEVEJ1xuICAgIClcblxuICAgIC8vIEhlYWx0aCBjaGVjayBvbiBBTEJcbiAgICBmYXJnYXRlU2VydmljZS50YXJnZXRHcm91cC5jb25maWd1cmVIZWFsdGhDaGVjayh7XG4gICAgICBwYXRoOiAnL2hlYWx0aCcsXG4gICAgICBoZWFsdGh5SHR0cENvZGVzOiAnMjAwJyxcbiAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcbiAgICB9KVxuXG4gICAgLy8gU2VjdXJpdHkgZ3JvdXA6IGFsbG93IGluYm91bmQgODAvNDQzIGZyb20gQUxCIChoYW5kbGVkIGJ5IGRlZmF1bHQpXG4gICAgLy8gQWRkIENPUlMgb3JpZ2lucyB0byB0YXNrIGVudiBpZiBuZWVkZWRcblxuICAgIC8vIE91dHB1dDogVVJMXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xvYWRCYWxhbmNlckROUycsIHtcbiAgICAgIHZhbHVlOiBmYXJnYXRlU2VydmljZS5sb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQUxCIEROUyBuYW1lIGZvciBQcm9maWxlcyBBUEknLFxuICAgICAgZXhwb3J0TmFtZTogJ1Byb2ZpbGVzQXBpQWxiRG5zJyxcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NlcnZpY2VVUkwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHA6Ly8ke2ZhcmdhdGVTZXJ2aWNlLmxvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Byb2ZpbGVzIEFQSSBVUkwgKHVzZSBIVFRQUyB3aXRoIEFDTSBjZXJ0aWZpY2F0ZSBmb3IgcHJvZHVjdGlvbiknLFxuICAgICAgZXhwb3J0TmFtZTogJ1Byb2ZpbGVzQXBpVXJsJyxcbiAgICB9KVxuICB9XG59XG4iXX0=