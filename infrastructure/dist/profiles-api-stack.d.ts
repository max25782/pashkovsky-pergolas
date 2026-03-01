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
}
export declare class ProfilesApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: ProfilesApiStackProps);
}
