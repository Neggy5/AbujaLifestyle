const http = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = Number(process.env.PORT || 8080);

const app = next({
  dev,
  hostname,
  port,
});

const handle = app.getRequestHandler();

const citizens = new Map();

async function main() {
  await app.prepare();

  const httpServer = http.createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    transports: ['websocket', 'polling'],
    cors: {
      origin: true,
      credentials: true,
    },
  });

  function broadcastPresence() {
    io.emit('presence', [...citizens.values()]);
  }

  io.on('connection', (socket) => {
    console.log('[abuja-live] connected:', socket.id);

    socket.on('join-city', (citizen) => {
      if (!citizen?.id || !citizen?.username) return;

      citizens.set(socket.id, {
        id: String(citizen.id),
        username: String(citizen.username).slice(0, 24),
        avatar: String(citizen.avatar || '🧑🏾').slice(0, 8),
        district: String(citizen.district || 'Wuse'),
        x: Number(citizen.x) || 50,
        y: Number(citizen.y) || 50,
      });

      broadcastPresence();
    });

    socket.on('move', (payload) => {
      const citizen = citizens.get(socket.id);

      if (!citizen) return;

      const x = Number(payload?.x);
      const y = Number(payload?.y);

      if (Number.isFinite(x)) {
        citizen.x = Math.max(2, Math.min(98, x));
      }

      if (Number.isFinite(y)) {
        citizen.y = Math.max(2, Math.min(98, y));
      }

      if (payload?.district) {
        citizen.district = String(payload.district);
      }

      broadcastPresence();
    });

    socket.on('district', (payload) => {
      const citizen = citizens.get(socket.id);

      if (!citizen || !payload?.district) return;

      citizen.district = String(payload.district);

      broadcastPresence();
    });

    socket.on('chat', (payload) => {
      const citizen = citizens.get(socket.id);

      if (!citizen) return;

      const message = String(payload?.message || '')
        .trim()
        .slice(0, 300);

      if (!message) return;

      io.emit('chat', {
        username: citizen.username,
        message,
      });
    });

    socket.on('disconnect', () => {
      console.log('[abuja-live] disconnected:', socket.id);

      citizens.delete(socket.id);

      broadcastPresence();
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(
      `[abuja-live] listening on ${hostname}:${port}`
    );
  });
}

main().catch((error) => {
  console.error('[abuja-live] startup failed', error);
  process.exit(1);
});
