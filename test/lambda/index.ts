export async function handler(event: any, context: any) {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/plain',
    },
    body: 'hello',
  };
}
