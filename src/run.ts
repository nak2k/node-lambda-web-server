import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { createApplication, CreateApplicationOptions } from './application';

interface RunOptions extends CreateApplicationOptions {
  host?: string;
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

    server.listen(options.port, options.host || '127.0.0.1', function () {
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
