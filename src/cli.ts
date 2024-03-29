import yargs = require('yargs');
import { exitOnError } from './exitOnError';
import { run } from './run';
import { promises } from 'fs';
import { getPort } from 'hashed-port';

const { stat } = promises;

async function main() {
  const argv = await yargs
    .options({
      code: {
        describe: 'A path of a Lambda function',
        type: 'string',
        default: '.',
      },
      handler: {
        describe: 'Names of a module and a function',
        type: 'string',
        default: 'index.handler',
      },
      host: {
        describe: 'Listen host',
        type: 'string',
      },
      open: {
        describe: 'Open automatically',
        type: 'boolean',
      },
      'payload-v2': {
        describe: 'Invoke the lambda with payload v2',
        type: 'boolean',
      },
      port: {
        alias: 'p',
        describe: 'Listen port',
        type: 'number',
      },
      project: {
        alias: 'P',
        describe: 'A path of tsconfig.json',
        type: 'string',
      },
      preprocessor: {
        describe: 'A path of a preprocessor module',
        type: 'string',
      },
      'role-arn': {
        describe: 'Role for a Lambda function',
        type: 'string',
      },
      verbose: {
        alias: 'v',
        describe: 'Verbose mode',
        type: 'boolean',
        default: false,
      },
    })
    .version()
    .help()
    .argv;

  const stats = await stat(argv.code);
  if (!stats.isDirectory()) {
    throw new Error('The --code option supports only a path of a directory');
  }

  if (argv.port === undefined) {
    argv.port = await getPort().catch(err => 0);
  }

  await run(argv);
}

main().catch(exitOnError);
