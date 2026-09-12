import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
export interface ProfilesApiStackProps extends cdk.StackProps {
    /**
     * Optional: existing VPC. If not provided, default VPC is used.
     */
    vpc?: ec2.IVpc;
    /**
     * Full ARN of Secrets Manager secret (must include 6-char suffix, e.g. ...-6YdziU).
     * Alternative: use secretsName instead.
     */
    secretsArn?: string;
    /**
     * Secret name (e.g. pashkovsky-profiles-api-secrets). Use when ARN suffix is unknown.
     * Secret must exist in the same region as the stack.
     */
    secretsName?: string;
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
    domainName?: string;
    /**
     * Existing ACM certificate for `domainName`. When omitted a certificate is
     * created with DNS validation, and `cdk deploy` blocks until the validation
     * CNAME shown in the CloudFormation events is added to Vercel DNS.
     */
    certificateArn?: string;
}
export declare class ProfilesApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: ProfilesApiStackProps);
}
