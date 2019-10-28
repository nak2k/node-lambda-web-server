import split = require('split');
import typeis = require('type-is');
import { get } from 'caseless-get';
import { cyan, red } from 'chalk';

const logMapper = (options: { label: string, limit?: number }) => (line: string) => {
  if (!line) {
    return;
  }

  const {
    label,
    limit = 4096,
  } = options;

  const timestamp = (new Date()).toLocaleTimeString();

  if (limit && line.length > limit) {
    line = line.substr(0, limit) + '\n' + red('*** truncated ***');
    return `[${label}] ${timestamp} ${line}\n`;
  }

  let json;

  try {
    json = JSON.parse(line);
  } catch (err) {
    // Ignore parsing error.
    return `[${label}] ${timestamp} ${line}\n`;
  }

  if (typeof json === 'object' && json !== null && json.headers) {
    const contentType = get(json.headers, 'content-type');

    if (typeis.is(contentType, ['application/json'])) {
      try {
        json.body = JSON.parse(json.body);
      } catch (err) {
        // Ignore parsing error.
      }
    }
  }

  line = JSON.stringify(json, null, 2);

  return `[${label}] ${timestamp} ${line}\n`;
};

export function lambdaLogger() {
  const lambdaStdout = split(logMapper({
    label: cyan('Lambda:INFO'),
  }));

  lambdaStdout.pipe(process.stdout);

  const lambdaStderr = split(logMapper({
    label: red('Lambda:ERROR'),
  }));

  lambdaStderr.pipe(process.stderr);

  return {
    lambdaStdout,
    lambdaStderr,
  };
}
