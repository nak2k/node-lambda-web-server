import express = require('express');
import { apiGatewayBodyParser } from 'api-gateway-body-parser';
import { lambdaHandler, LambdaManager, LambdaHandlerOptions } from './lambda-handler';

interface CreateApplicationResult {
  app: express.Application;
  lambdaManager: LambdaManager;
}

export async function createApplication(options: LambdaHandlerOptions): Promise<CreateApplicationResult> {
  const app = express();

  const {
    lambdaManager,
    middleware,
  } = await lambdaHandler(options);

  app.use(apiGatewayBodyParser());
  app.use(middleware);

  return {
    app,
    lambdaManager,
  };
}
