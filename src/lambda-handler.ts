import { spawnLambda, INIT_RESULT, LambdaProcess } from 'lambda-spawn';
import type { RequestHandler, Request, Response } from 'express';
import { promises } from 'fs';
import { join } from 'path';
import { lambdaLogger } from './logger';
import { promisify } from 'util';

const { stat, access } = promises;

export interface LambdaManager {
  killAll(): void;
}

export interface LambdaHandlerOptions {
  code: string;
  handler: string;
  project?: string;
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
      const event = {
        ...reqToEvent(req),
        resource: req.path,
        pathParameters: {},
        stageVariables: null,
        requestContext: {
          path: req.path,
          accountId: '',
          resourceId: '',
          stage: '',
          requestId: '',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: '',
            cognitoIdentityId: null,
            caller: '',
            apiKey: '',
            sourceIp: '',
            accessKey: '',
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: '',
            userAgent: '',
            user: '',
          },
          resourcePath: req.path,
          httpMethod: '',
          apiId: '',
        },
      };
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

        setResFromResult(res, result, next);
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

            setResFromResult(res, result, next);
          });
        });
      }
    },
  };
}

function reqToEvent(req: Request) {
  const { headers, multiValueHeaders } = makeHeadersFromRaw(req.rawHeaders);

  return {
    path: req.path,
    httpMethod: req.method,
    headers,
    multiValueHeaders,
    queryStringParameters: req.query,
    body: typeof (req.body) === 'string' ? req.body : '',
    isBase64Encoded: req.isBase64Encoded,
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

interface LambdaResult {
  statusCode: number;
  headers: { [name: string]: string };
  body: string;
  isBase64Encoded: boolean;
  multiValueHeaders: { [name: string]: string[] };
}

function setResFromResult(res: Response, result: LambdaResult, next: (err: Error | null) => void) {
  if (typeof (result) !== 'object' || result === null) {
    return next(new Error('Non-object returned by Lambda'));
  }

  const {
    statusCode,
    headers,
    body,
    isBase64Encoded,
    multiValueHeaders,
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

  if (multiValueHeaders) {
    if (typeof (headers) !== 'object') {
      return next(new Error('Non-object multiValueHeaders returned by Lambda'));
    }

    Object.entries(multiValueHeaders).forEach(([name, values]) => {
      res.setHeader(name, values);
    });
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