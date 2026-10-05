/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable trailing slashes for consistent path handling
  // Engine.IO will own /socket.io (no trailing slash)
  trailingSlash: false,

  // Ensure we're not normalizing paths
  skipTrailingSlashRedirect: false,
};

module.exports = nextConfig;

