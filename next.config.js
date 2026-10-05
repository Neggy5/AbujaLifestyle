/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do NOT use output: 'standalone' with a custom HTTP server.
  // The custom server.js wraps the Next.js app with Socket.IO.

  // Disable trailing slashes for consistent path handling
  // Engine.IO will own /socket.io (no trailing slash)
  trailingSlash: false,
};

module.exports = nextConfig;

