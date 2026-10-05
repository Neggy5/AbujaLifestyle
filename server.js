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

// Connected citizens.
// Key = Socket.IO socket ID.
const citizens = new Map();

async function main() {
  await app.prepare();

  /*
   * Create the HTTP server BEFORE Socket.IO.
   * Socket.IO will attach its Engine.IO handler
   * to this server instance.
   */
  const httpServer = http.createServer();

  const io = new Server(httpServer, {
    // Path without trailing slash
    path: '/socket.io',
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
   * CRITICAL:
   *
   * Socket.IO/Engine.IO attaches to the httpServer
   * before we add our custom request handler.
   * Engine.IO will intercept /socket.io* requests.
   *
   * We then add a request handler that routes
   * everything EXCEPT /socket.io to Next.js.
   *
   * This ordering ensures Engine.IO owns the path
   * before Next.js sees it.
   */
  httpServer.on('request', (req, res) => {
    const pathname = req.url?.split('?')[0] || '/';

    /*
     * Engine.IO handles /socket.io and /socket.io/*
     * Socket.IO attaches itself to the server and
     * listens for these paths automatically.
     *
     * We explicitly check and skip Next.js handling
     * to let Engine.IO's internal handler process them.
     */
    if (
      pathname === '/socket.io' ||
      pathname.startsWith('/socket.io/')
    ) {
      // Engine.IO will handle this via the attached handler
      // Do NOT call handle() here; let it pass through
      return;
    }

    // Everything else goes to Next.js
    return handle(req, res);
  });

  /*
   * Broadcast current online citizens.
   */
  function broadcastPresence() {
    const list = Array.from(citizens.values());

    io.emit('presence', list);

    console.log(
      `[abuja-live] presence broadcast: ${list.length} citizen(s)`
    );
  }

  /*
   * Socket.IO connection.
   */
  io.on('connection', (socket) => {
    console.log(
      '[abuja-live] connected:',
      socket.id,
      '| transport:',
      socket.conn.transport.name
    );

    /*
     * Transport upgrade.
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
     * Citizen moves.
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
     * Underlying transport closes.
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
     * Socket disconnect.
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
   * Start server.
   */
  httpServer.listen(
    port,
    hostname,
    () => {
      console.log(
        `[abuja-live] listening on ${hostname}:${port}`
      );

      console.log(
        '[abuja-live] Socket.IO path: /socket.io'
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

