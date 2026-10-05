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

// All currently connected citizens.
// Key = Socket.IO socket ID.
const citizens = new Map();

async function main() {
  await app.prepare();

  /*
   * Create the HTTP server first.
   *
   * Socket.IO attaches its Engine.IO handler directly
   * to this server. Do NOT manually call
   * io.engine.handleRequest().
   */
  const httpServer = http.createServer();

  const io = new Server(httpServer, {
    path: '/socket.io'

    transports: ['polling', 'websocket'],

    cors: {
      origin: true,
      credentials: true,
    },

    pingInterval: 25000,
    pingTimeout: 20000,

    maxHttpBufferSize: 1e6,
  });

  /*
   * Next.js handles normal HTTP requests.
   *
   * Socket.IO owns /socket.io/*.
   */
  httpServer.on('request', (req, res) => {
    if (req.url?.startsWith('/socket.io/')) {
      return;
    }

    return handle(req, res);
  });

  /*
   * Send the current online citizens to everybody.
   */
  function broadcastPresence() {
    const list = Array.from(citizens.values());

    io.emit('presence', list);

    console.log(
      `[abuja-live] presence broadcast: ${list.length} citizen(s)`
    );
  }

  /*
   * New Socket.IO connection.
   */
  io.on('connection', (socket) => {
    console.log(
      '[abuja-live] connected:',
      socket.id,
      '| transport:',
      socket.conn.transport.name
    );

    /*
     * When polling upgrades to WebSocket.
     */
    socket.conn.on('upgrade', () => {
      console.log(
        '[abuja-live] transport upgraded:',
        socket.id,
        '| transport:',
        socket.conn.transport.name
      );
    });

    /*
     * Citizen enters the city.
     */
    socket.on('join-city', (citizen) => {
      if (!citizen?.id || !citizen?.username) {
        console.warn(
          '[abuja-live] invalid join-city:',
          socket.id
        );

        return;
      }

      const id = String(citizen.id);

      const username = String(
        citizen.username
      )
        .trim()
        .slice(0, 24);

      const avatar = String(
        citizen.avatar || '🧑🏾'
      ).slice(0, 8);

      const district = String(
        citizen.district || 'Wuse'
      ).slice(0, 32);

      const rawX = Number(citizen.x);
      const rawY = Number(citizen.y);

      const x = Number.isFinite(rawX)
        ? Math.max(2, Math.min(98, rawX))
        : 50;

      const y = Number.isFinite(rawY)
        ? Math.max(2, Math.min(98, rawY))
        : 50;

      const connectedCitizen = {
        id,
        username,
        avatar,
        district,
        x,
        y,
      };

      citizens.set(
        socket.id,
        connectedCitizen
      );

      console.log(
        '[abuja-live] joined:',
        username,
        '| district:',
        district,
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

      if (
        !citizen ||
        !payload?.district
      ) {
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
     * City chat.
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
        '->',
        message
      );

      io.emit('chat', {
        username: citizen.username,
        message,
      });
    });

    /*
     * Underlying transport closed.
     */
    socket.conn.on('close', (reason) => {
      console.log(
        '[abuja-live] transport closed:',
        socket.id,
        '| reason:',
        reason
      );
    });

    /*
     * Citizen disconnects.
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
   * Engine.IO connection errors.
   */
  io.engine.on(
    'connection_error',
    (error) => {
      console.error(
        '[abuja-live] engine connection error:',
        {
          message: error.message,
          code: error.code,
          context: error.context,
        }
      );
    }
  );

  /*
   * Start HTTP + Socket.IO server.
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
   * Graceful Railway shutdown.
   */
  function shutdown(signal) {
    console.log(
      `[abuja-live] ${signal} received`
    );

    io.close(() => {
      httpServer.close(() => {
        console.log(
          '[abuja-live] server closed'
        );

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
