#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { OrderServiceStatefulStack } from '../stateful/stateful';
import { OrderServiceStatelessStack } from '../stateless/stateless';

// aws domain account lookups
// note: this would typically come from a config service
const enum domainAccountIds {
  'central' = '111111111111',
}

const app = new cdk.App();
const stateful = new OrderServiceStatefulStack(
  app,
  'OrderServiceStatefulStack',
  {}
);
new OrderServiceStatelessStack(app, 'OrderServiceStatelessStack', {
  table: stateful.table,
  central: domainAccountIds.central,
});
