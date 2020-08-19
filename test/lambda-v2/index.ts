import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { assert } from 'console';

export async function handler(event: APIGatewayProxyEventV2, context: any) {
  assert(event.version === '2.0');

  assert(typeof event.headers === 'object');
  assert(typeof event.rawPath === 'string');

  assert(typeof event.requestContext === 'object');
  assert(typeof event.requestContext.http === 'object');
  assert(typeof event.requestContext.http.method === 'string');

  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/plain',
    },
    body: 'hello',
  };
}
