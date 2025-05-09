// server.ts
import { createServer, Server as HttpServerNode, IncomingMessage, ServerResponse } from 'http';
import next from 'next';
import { initSocketIO } from './lib/socket';
import { parse } from 'url'; // Import parse from 'url'

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';

// Corrected port definition
const portEnv = process.env.PORT;
let port = 3000; // Default port
if (portEnv) {
  const parsedPort = parseInt(portEnv, 10);
  // Ensure parsedPort is a valid number and a typical port range
  if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort < 65536) { 
    port = parsedPort;
  } else {
    console.warn(`Invalid process.env.PORT value: "${portEnv}". Falling back to default port ${port}.`);
  }
}

const app = next({ dev, hostname, port }); // Now 'port' is guaranteed to be a number
const nextRequestHandler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer: HttpServerNode = createServer((req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parse(req.url!, true);
    // Let Socket.IO handle its own path.
    // The Socket.IO server instance (created in initSocketIO) attaches its own listeners
    // to the httpServer. If the path is not for Socket.IO, then pass to Next.js.
    // This check here is more of a conceptual guard; Socket.IO's internal listeners
    // on httpServer should ideally claim the /socket.io/ requests.
    // If they don't, this explicit routing won't help much unless we manually call an io handler.
    // The key is that Socket.IO is attached to the httpServer *before* listen.
    nextRequestHandler(req, res, parsedUrl);
  });
  
  initSocketIO(httpServer); // Initialize Socket.IO and attach it to httpServer

  httpServer
    .listen(port, () => {
      console.log(`> Next.js Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO attached to the same server.`);
    })
    .on('error', (err: any) => {
      console.error('Server error:', err);
      process.exit(1);
    });
});
