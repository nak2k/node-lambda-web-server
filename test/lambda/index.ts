export async function handler(event: any, context: any) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
    body: 'hello',
  };
}
