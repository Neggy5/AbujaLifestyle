/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output as standalone for Docker deployment
  output: 'standalone',

  // Disable trailing slashes for consistent path handling
  // Engine.IO will own /socket.io (no trailing slash)
  trailingSlash: false,
};

module.exports = nextConfig;

