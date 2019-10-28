import * as test from 'tape';
import { run } from '../lib/run';
import { get } from 'http';
import { AddressInfo } from 'net';

test('test', t => {
  t.plan(2);

  (async () => {
    const server = await run({
      code: 'test/lambda',
      handler: 'index.handler',
    });

    const { address, port } = server.address() as AddressInfo;
    const endpoint = `http://${address}:${port}`;

    get(endpoint!, res => {
      t.equal(res.statusCode, 200);
      t.equal(res.headers['content-type'], 'text/plain; charset=utf-8');

      server.close();
    });
  })().catch(err => t.fail(err));
});
