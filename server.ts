// server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initSocketIO } from './lib/socket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const nextRequestHandler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer: any = createServer((req: any, res: any) => {
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
    })
    .on('error', (err: any) => {
      console.error('Server error:', err);
      process.exit(1);
    });
});
