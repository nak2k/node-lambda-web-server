import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { createApplication } from './application';
import { LambdaHandlerOptions } from './lambda-handler';

interface RunOptions extends LambdaHandlerOptions {
  port?: number;
  open?: boolean;
}

export async function run(options: RunOptions) {
  const { app, lambdaManager } = await createApplication(options);
  const server = createServer(app);

  return await new Promise<Server>((resolve, reject) => {
    server.once('error', reject);

    server.on('close', () => {
      lambdaManager.killAll();
    });

    server.listen(options.port, 'localhost', function () {
      const { address, port } = server.address() as AddressInfo;
      const endpoint = `http://${address}:${port}`;
      console.log(`Listening: ${endpoint}`);

      if (options.open) {
        const open = require('open');
        open(endpoint);
      }

      resolve(server);
    });
  });
}
