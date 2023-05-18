import * as test from 'tape';
import { run } from '../lib/run';
import { AddressInfo } from 'net';
import { fetch } from "undici";

test('test payload v2', async t => {
  t.plan(11);

  const server = await run({
    code: 'test/lambda-v2',
    handler: 'index.handler',
    payloadV2: true,
  });

  try {
    const { address, port } = server.address() as AddressInfo;
    const endpoint = `http://${address}:${port}/?color[]=blue&color[]=red`;

    const res = await fetch(endpoint);

    t.equal(res.status, 200);
    t.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');

    const event: any = await res.json();

    t.equal(event.version, '2.0', "event.version");

    t.equal(typeof event.routeKey, 'string', "event.routeKey");
    t.equal(typeof event.rawPath, 'string', "event.rawPath");
    t.equal(typeof event.rawQueryString, 'string', "event.rawQueryString");
    t.equal(typeof event.headers, 'object', "event.headers");
    t.equal(typeof event.queryStringParameters, 'object', "event.queryStringParameters");

    t.equal(typeof event.requestContext, 'object', "event.requestContext");
    t.equal(typeof event.requestContext.http, 'object', "event.requestContext.http");
    t.equal(typeof event.requestContext.http.method, 'string', "event.requestContext.http.method");
  } finally {
    server.close();
  }
});
