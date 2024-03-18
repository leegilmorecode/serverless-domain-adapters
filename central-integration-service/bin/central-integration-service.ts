#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { CentralIntegrationServiceStatefulStack } from '../stateful/stateful';
import { CentralIntegrationServiceStatelessStack } from '../stateless/stateless';

const app = new cdk.App();

// aws domain account lookups
// note: this would typically come from a config service
const enum domainAccountIds {
  'central' = '111111111111',
  'delivery' = '222222222222',
  'orders' = '333333333333',
  'warehouse' = '444444444444',
  'org' = 'o-1234abcd',
}

const stateful = new CentralIntegrationServiceStatefulStack(
  app,
  'CentralIntegrationServiceStatefulStack',
  {
    org: domainAccountIds.org,
    central: domainAccountIds.central,
    orders: domainAccountIds.orders,
    delivery: domainAccountIds.delivery,
    warehouse: domainAccountIds.warehouse,
  }
);
new CentralIntegrationServiceStatelessStack(
  app,
  'CentralIntegrationServiceStatelessStack',
  {
    centralTopic: stateful.centralTopic,
    bus: stateful.bus,
  }
);
