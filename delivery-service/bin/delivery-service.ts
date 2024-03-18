#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { DeliveryServiceStatefulStack } from '../stateful/stateful';
import { DeliveryServiceStatelessStack } from '../stateless/stateless';

// aws domain account lookups
// note: this would typically come from a config service
const enum domainAccountIds {
  'central' = '111111111111',
}

const app = new cdk.App();
const stateful = new DeliveryServiceStatefulStack(
  app,
  'DeliveryServiceStatefulStack',
  {
    central: domainAccountIds.central,
  }
);
new DeliveryServiceStatelessStack(app, 'DeliveryServiceStatelessStack', {
  bus: stateful.bus,
  table: stateful.table,
});
