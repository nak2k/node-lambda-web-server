import express = require('express');
import { apiGatewayBodyParser } from 'api-gateway-body-parser';
import { lambdaHandler, LambdaManager, LambdaHandlerOptions } from './lambda-handler';
import { resolve } from "path";

export interface CreateApplicationOptions extends LambdaHandlerOptions {
  preprocessor?: string;
}

interface CreateApplicationResult {
  app: express.Application;
  lambdaManager: LambdaManager;
}

export async function createApplication(options: CreateApplicationOptions): Promise<CreateApplicationResult> {
  const app = express();

  if (options.preprocessor) {
    if (options.preprocessor.endsWith(".ts")) {
      require('ts-node').register();
    }

    const preprocessor = require(resolve(options.preprocessor));

    if (typeof preprocessor.configure !== 'function') {
      throw new Error(`The preprocessor module "${options.preprocessor}" must export the "configure" function`);
    }

    await preprocessor.configure(app);
  }

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
