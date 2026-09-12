#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { ProfilesApiStack } from './profiles-api-stack'

const app = new cdk.App()

const secretsArn = app.node.tryGetContext('secretsArn') as string | undefined
const secretsName = app.node.tryGetContext('secretsName') as string | undefined
const certificateArn = app.node.tryGetContext('certificateArn') as string | undefined

// Hostname the CRM calls. Deploy HTTP-only (scratch environments) with
// `-c domainName=""`; anything serving real traffic must keep a domain so the
// ALB terminates TLS — CRM forwards caller JWTs to this API.
const domainNameContext = app.node.tryGetContext('domainName') as string | undefined
const domainName =
  domainNameContext === undefined
    ? 'profiles-api.pashkovsky-group.com'
    : domainNameContext || undefined

new ProfilesApiStack(app, 'ProfilesApiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-north-1',
  },
  description: 'NestJS Profiles API on ECS Fargate',
  secretsArn,
  secretsName,
  domainName,
  certificateArn,
})
