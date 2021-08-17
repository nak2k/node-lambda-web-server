import { spawnLambda, INIT_RESULT, LambdaProcess } from 'lambda-spawn';
import type { RequestHandler, Request, Response } from 'express';
import { promises } from 'fs';
import { join } from 'path';
import { lambdaLogger } from './logger';
import { promisify } from 'util';
import type { APIGatewayProxyEvent } from "aws-lambda";

const { stat, access } = promises;

export interface LambdaManager {
  killAll(): void;
}

export interface LambdaHandlerOptions {
  code: string;
  handler: string;
  project?: string;
  payloadV2?: boolean;
  roleArn?: string;
}

interface LambdaHandlerResult {
  lambdaManager: LambdaManager;
  middleware: RequestHandler;
}

export async function lambdaHandler(options: LambdaHandlerOptions): Promise<LambdaHandlerResult> {
  if (!(await stat(options.code)).isDirectory()) {
    throw new Error('options.code must be a path of a directory');
  }

  let typescript: boolean;

  try {
    await access(join(options.code, `${options.handler.split('.')[0]}.ts`));
    typescript = true;
  } catch (err) {
    typescript = false;
  }

  let lambdaProcess: LambdaProcess | undefined;

  await promisify(createLambdaProcess)();

  function createLambdaProcess(callback: (err: Error | null) => void) {
    lambdaProcess = spawnLambda({
      handler: options.handler,
      moduleDir: options.code,
      typescript,
      env: {
        ...process.env,
        AWS_SAM_LOCAL: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      project: options.project,
      roleArn: options.roleArn,
    });

    const { lambdaStdout, lambdaStderr } = lambdaLogger();

    lambdaProcess.stdout!.pipe(lambdaStdout);
    lambdaProcess.stderr!.pipe(lambdaStderr);

    lambdaProcess.on('error', callback);

    lambdaProcess.on(INIT_RESULT, ({ err }) => {
      if (err) {
        return callback(err);
      }

      callback(null);
    });

    lambdaProcess.on('exit', (code, signal) => {
      lambdaProcess = undefined;
    });
  }

  return {
    lambdaManager: {
      killAll() {
        if (lambdaProcess) {
          lambdaProcess.kill();
        }
      },
    },
    middleware: (req, res, next) => {
      const event = options.payloadV2 ? reqToEventV2(req) : reqToEvent(req);
      const context = {};

      if (!lambdaProcess) {
        restartLambda();
        return;
      }

      lambdaProcess.invoke(event, context, (err, result) => {
        if (err) {
          if ((err as any).code === 'ERR_IPC_CHANNEL_CLOSED') {
            restartLambda();
            return;
          }

          return next(err);
        }

        setResFromResult(res, result, !!options.payloadV2, next);
      });

      function restartLambda() {
        createLambdaProcess(err => {
          if (err) {
            return next(err);
          }

          if (!lambdaProcess) {
            return next(new Error('The lambda process not exists'));
          }

          lambdaProcess.invoke(event, context, (err, result) => {
            if (err) {
              return next(new Error('Restarting the lambda process failed'));
            }

            setResFromResult(res, result, !!options.payloadV2, next);
          });
        });
      }
    },
  };
}

function reqToEvent(req: Request): APIGatewayProxyEvent {
  const { headers, multiValueHeaders } = makeHeadersFromRaw(req.rawHeaders);
  const { queryStringParameters, multiValueQueryStringParameters } = makeQueryStringParameters(req);

  const authorizer = parseAuthorization(req.headers.authorization);

  return {
    path: req.path,
    httpMethod: req.method,
    headers,
    multiValueHeaders,
    queryStringParameters,
    multiValueQueryStringParameters,
    body: typeof (req.body) === 'string' ? req.body : '',
    isBase64Encoded: req.isBase64Encoded,
    resource: req.path,
    pathParameters: {},
    stageVariables: null,
    requestContext: {
      path: req.path,
      accountId: '',
      resourceId: '',
      stage: '',
      requestId: '',
      authorizer,
      identity: {
        cognitoIdentityPoolId: null,
        accountId: '',
        cognitoIdentityId: null,
        caller: '',
        apiKey: '',
        apiKeyId: "",
        sourceIp: '',
        accessKey: '',
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: '',
        userAgent: '',
        user: '',
        clientCert: null,
        principalOrgId: "",
      },
      resourcePath: req.path,
      httpMethod: '',
      apiId: '',
      protocol: '',
      requestTimeEpoch: Date.now(),
    },
  };
}

function reqToEventV2(req: Request) {
  const { headers } = makeHeadersFromRaw(req.rawHeaders);
  const now = Date.now();

  const indexOfQS = req.url.indexOf('?');

  const authorizer = parseAuthorization(req.headers.authorization);

  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: req.path,
    rawQueryString: indexOfQS >= 0 ? req.url.substr(indexOfQS + 1) : undefined,
    cookies: undefined,
    headers,
    queryStringParameters: req.query,
    requestContext: {
      accountId: '',
      apiId: '',
      authorizer: authorizer && { jwt: authorizer },
      domainName: req.hostname,
      domainPrefix: '',
      http: {
        method: req.method,
        path: req.path,
        protocol: req.httpVersion,
        sourceIp: req.ip,
        userAgent: req.headers['user-agent'],
      },
      requestId: '',
      routeKey: '$default',
      stage: '',
      time: new Date(now).toString(),
      timeEpoch: now,
    },
    body: typeof (req.body) === 'string' ? req.body : '',
    pathParameters: undefined,
    isBase64Encoded: req.isBase64Encoded,
    stageVariables: undefined,
  };
}

function makeHeadersFromRaw(raw: string[]) {
  const headers: { [name: string]: string } = {};
  const multiValueHeaders: { [name: string]: string[] } = {};

  for (let i = 0; i < raw.length; i += 2) {
    const name = raw[i];
    const value = raw[i + 1];

    headers[name] = value;

    const {
      [name]: values = multiValueHeaders[name] = [],
    } = multiValueHeaders;

    values.push(value);
  }

  return {
    headers,
    multiValueHeaders,
  };
}

function makeQueryStringParameters(req: Request) {
  const queryStringParameters: { [key: string]: string } = {};
  const multiValueQueryStringParameters: { [key: string]: string[] } = {};

  const searchParams = new URLSearchParams(req.originalUrl.substr(req.originalUrl.indexOf("?")));

  searchParams.forEach((value, key) => {
    queryStringParameters[key] = value;

    const multiValues = multiValueQueryStringParameters[key] || (
      multiValueQueryStringParameters[key] = []
    );

    multiValues.push(value);
  });

  return {
    queryStringParameters,
    multiValueQueryStringParameters,
  };
}

function parseAuthorization(authorization?: string) {
  if (!authorization) {
    return;
  }

  const match = authorization.match(/^\s*(?<token1>\S+)(\s+(?<token2>\S+))?/);

  if (!match?.groups) {
    return;
  }

  const { token1, token2 } = match.groups;
  const token = token2 || token1;

  const [, payload,] = token.split(".");
  if (!payload) {
    return;
  }

  const decodedPayload = Buffer.from(payload, 'base64').toString();
  const claims = JSON.parse(decodedPayload);

  const { scope = "", ...rest } = claims;

  return {
    claims: rest,
    scopes: scope.split(" "),
  };
}

interface LambdaResult {
  statusCode: number;
  headers: { [name: string]: string };
  body: string;
  isBase64Encoded: boolean;
  multiValueHeaders: { [name: string]: string[] };
  cookies: string[];
}

function setResFromResult(res: Response, result: LambdaResult, payloadV2: boolean, next: (err: Error | null) => void) {
  if (typeof (result) !== 'object' || result === null) {
    return next(new Error('Non-object returned by Lambda'));
  }

  const {
    statusCode,
    headers,
    body,
    isBase64Encoded,
    multiValueHeaders,
    cookies,
  } = result;

  if (typeof (statusCode) !== 'number') {
    return next(new Error('No statusCode returned by Lambda'));
  }

  res.status(statusCode);

  if (headers) {
    if (typeof (headers) !== 'object') {
      return next(new Error('Non-object headers returned by Lambda'));
    }

    res.set(headers);
  }

  if (!payloadV2 && multiValueHeaders) {
    if (typeof (multiValueHeaders) !== 'object') {
      return next(new Error('Non-object multiValueHeaders returned by Lambda'));
    }

    Object.entries(multiValueHeaders).forEach(([name, values]) => {
      res.setHeader(name, values);
    });
  }

  if (payloadV2 && cookies) {
    res.header('set-cookie', cookies);
  }

  if (body) {
    if (typeof (body) !== 'string') {
      return next(new Error('Non-string body returned by Lambda'));
    }

    if (isBase64Encoded) {
      res.send(Buffer.from(body, 'base64'));
    } else {
      res.send(body);
    }
  }

  res.end();
}
