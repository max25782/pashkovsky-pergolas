#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { ProfilesApiStack } from './profiles-api-stack'

const app = new cdk.App()

const secretsArn = app.node.tryGetContext('secretsArn') as string | undefined
const secretsName = app.node.tryGetContext('secretsName') as string | undefined

new ProfilesApiStack(app, 'ProfilesApiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-north-1',
  },
  description: 'NestJS Profiles API on ECS Fargate',
  secretsArn,
  secretsName,
})
