#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ExampleVpcStack } from './example-vpc';

// Follow the setup process at https://docs.aws.amazon.com/cdk/v2/guide/environments.html
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();
new ExampleVpcStack(app, 'ExampleVpcStack', { env });
