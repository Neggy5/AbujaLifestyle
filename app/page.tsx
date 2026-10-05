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

// Connected citizens in this server instance.
const citizens = new Map();

async function main() {
  await app.prepare();

  /*
   * IMPORTANT:
   * Create the HTTP server first.
   *
   * Socket.IO attaches its Engine.IO handlers directly to this
   * server. We must NOT manually call io.engine.handleRequest().
   */
  const httpServer = http.createServer();

  const io = new Server(httpServer, {
    path: '/socket.io/',

    // Railway works best when polling is available as a fallback.
    transports: ['polling', 'websocket'],

    // Allow the browser app to connect from the Railway domain.
    cors: {
      origin: true,
      credentials: true,
    },

    // Keep connections alive through Railway's proxy.
    pingInterval: 25000,
    pingTimeout: 20000,

    // Allow reasonably sized chat/payload messages.
    maxHttpBufferSize: 1e6,
  });

  /*
   * Let Next.js handle normal HTTP requests.
   *
   * Socket.IO owns /socket.io/*.
   * We deliberately do NOT forward those requests to Next.
   */
  httpServer.on('request', (req, res) => {
    if (req.url?.startsWith('/socket.io/')) {
      return;
    }

    handle(req, res);
  });

  function broadcastPresence() {
    const list = [...citizens.values()];

    io.emit('presence', list);

    console.log(
      `[abuja-live] presence broadcast: ${list.length} citizen(s)`
    );
  }

  io.on('connection', (socket) => {
    console.log(
      '[abuja-live] connected:',
      socket.id,
      'transport:',
      socket.conn.transport.name
    );

    socket.conn.on('upgrade', () => {
      console.log(
        '[abuja-live] transport upgraded:',
        socket.id,
        socket.conn.transport.name
      );
    });

    /*
     * Citizen joins Abuja.
     */
    socket.on('join-city', (citizen) => {
      if (!citizen?.id || !citizen?.username) {
        console.warn(
          '[abuja-live] rejected join:',
          socket.id
        );

        return;
      }

      const joinedCitizen = {
        id: String(citizen.id),
        username: String(citizen.username)
          .trim()
          .slice(0, 24),

        avatar: String(
          citizen.avatar || '🧑🏾'
        ).slice(0, 8),

        district: String(
          citizen.district || 'Wuse'
        ).slice(0, 32),

        x: Number.isFinite(Number(citizen.x))
          ? Math.max(
              2,
              Math.min(98, Number(citizen.x))
            )
          : 50,

        y: Number.isFinite(Number(citizen.y))
          ? Math.max(
              2,
              Math.min(98, Number(citizen.y))
            )
          : 50,
      };

      citizens.set(
        socket.id,
        joinedCitizen
      );

      console.log(
        '[abuja-live] joined:',
        joinedCitizen.username,
        '| district:',
        joinedCitizen.district,
        '| socket:',
        socket.id
      );

      broadcastPresence();
    });

    /*
     * Citizen moves around the map.
     */
    socket.on('move', (payload) => {
      const citizen = citizens.get(socket.id);

      if (!citizen) {
        return;
      }

      const x = Number(payload?.x);
      const y = Number(payload?.y);

      if (Number.isFinite(x)) {
        citizen.x = Math.max(
          2,
          Math.min(98, x)
        );
      }

      if (Number.isFinite(y)) {
        citizen.y = Math.max(
          2,
          Math.min(98, y)
        );
      }

      if (payload?.district) {
        citizen.district = String(
          payload.district
        ).slice(0, 32);
      }

      broadcastPresence();
    });

    /*
     * Citizen changes district.
     */
    socket.on('district', (payload) => {
      const citizen = citizens.get(socket.id);

      if (!citizen || !payload?.district) {
        return;
      }

      citizen.district = String(
        payload.district
      ).slice(0, 32);

      console.log(
        '[abuja-live] district change:',
        citizen.username,
        '->',
        citizen.district
      );

      broadcastPresence();
    });

    /*
     * Global city chat.
     */
    socket.on('chat', (payload) => {
      const citizen = citizens.get(socket.id);

      if (!citizen) {
        return;
      }

      const message = String(
        payload?.message || ''
      )
        .trim()
        .slice(0, 300);

      if (!message) {
        return;
      }

      console.log(
        '[abuja-live] chat:',
        citizen.username,
        message
      );

      io.emit('chat', {
        username: citizen.username,
        message,
      });
    });

    /*
     * Socket.IO heartbeat/ping failure.
     */
    socket.conn.on('close', (reason) => {
      console.log(
        '[abuja-live] connection transport closed:',
        socket.id,
        reason
      );
    });

    /*
     * Citizen leaves Abuja.
     */
    socket.on('disconnect', (reason) => {
      const citizen = citizens.get(socket.id);

      console.log(
        '[abuja-live] disconnected:',
        citizen?.username || socket.id,
        '| reason:',
        reason
      );

      citizens.delete(socket.id);

      broadcastPresence();
    });
  });

  /*
   * Socket.IO connection errors.
   */
  io.engine.on('connection_error', (error) => {
    console.error(
      '[abuja-live] engine connection error:',
      {
        message: error.message,
        code: error.code,
        context: error.context,
      }
    );
  });

  /*
   * Start the single HTTP server.
   */
  httpServer.listen(
    port,
    hostname,
    () => {
      console.log(
        `[abuja-live] listening on ${hostname}:${port}`
      );

      console.log(
        `[abuja-live] Socket.IO path: /socket.io/`
      );

      console.log(
        `[abuja-live] environment: ${
          process.env.NODE_ENV || 'unknown'
        }`
      );
    }
  );

  /*
   * Graceful shutdown.
   */
  function shutdown(signal) {
    console.log(
      `[abuja-live] ${signal} received, shutting down...`
    );

    io.close(() => {
      httpServer.close(() => {
        process.exit(0);
      });
    });

    setTimeout(() => {
      process.exit(0);
    }, 10000).unref();
  }

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}

main().catch((error) => {
  console.error(
    '[abuja-live] startup failed:',
    error
  );

  process.exit(1);
});
