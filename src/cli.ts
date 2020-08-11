import yargs = require('yargs');
import { exitOnError } from './exitOnError';
import { run } from './run';
import { promises } from 'fs';
import { getPort } from 'hashed-port';

const { stat } = promises;

async function main() {
  const argv = yargs
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
