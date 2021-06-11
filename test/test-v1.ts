import * as test from 'tape';
import { run } from '../lib/run';
import { AddressInfo } from 'net';
import fetch from 'node-fetch';

test('test payload v1', async t => {
  t.plan(15);

  const server = await run({
    code: 'test/lambda',
    handler: 'index.handler',
  });

  try {
    const { address, port } = server.address() as AddressInfo;
    const endpoint = `http://${address}:${port}/?color[]=blue&color[]=red`;

    const res = await fetch(endpoint);

    t.equal(res.status, 200);
    t.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');

    const event = await res.json();

    t.equal(typeof event.resource, 'string', "event.resource");
    t.equal(typeof event.path, 'string', "event.path");
    t.equal(typeof event.httpMethod, 'string', "event.httpMethod");
    t.equal(typeof event.headers, 'object', "event.headers");
    t.equal(typeof event.multiValueHeaders, 'object', "event.multiValueHeaders");
    t.equal(typeof event.queryStringParameters, 'object', "event.queryStringParameters");
    t.ok(["red", "blue"].includes(event.queryStringParameters["color[]"]), "event.queryStringParameters.color[]");
    t.equal(typeof event.multiValueQueryStringParameters, 'object', "event.multiValueQueryStringParameters");
    t.ok(event.multiValueQueryStringParameters["color[]"].includes("red"), "event.multiValueQueryStringParameters.color[]");
    t.ok(event.multiValueQueryStringParameters["color[]"].includes("blue"), "event.multiValueQueryStringParameters.color[]");

    t.equal(typeof event.requestContext, 'object', "event.requestContext");
    t.equal(typeof event.requestContext.path, 'string', "event.requestContext.path");
    t.equal(typeof event.requestContext.httpMethod, 'string', "event.requestContext.httpMethod");
  } finally {
    server.close();
  }
});
