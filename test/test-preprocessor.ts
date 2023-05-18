import * as test from 'tape';
import { run } from '../lib/run';
import { AddressInfo } from 'net';
import { fetch } from "undici";

test('test preprocessor', async t => {
  t.plan(2);

  const server = await run({
    code: 'test/lambda',
    handler: 'index.handler',
    preprocessor: 'test/preprocessor',
  });

  try {
    const { address, port } = server.address() as AddressInfo;
    const endpoint = `http://${address}:${port}/?color[]=blue&color[]=red`;

    const res = await fetch(endpoint);

    t.equal(res.status, 200);
    t.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  } finally {
    server.close();
  }
});
