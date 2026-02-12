/** @type {import('next').NextConfig} */
const backendPort = process.env.BACKEND_PORT || '5000';

// Get hostname from NEXT_PUBLIC_SITE_URL or default to localhost
const getSiteHostname = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      return new URL(siteUrl).hostname;
    } catch {
      return 'localhost';
    }
  }
  return 'localhost';
};

const siteHostname = getSiteHostname();
const isLocalhost = siteHostname === 'localhost';

const nextConfig = {
  images: {
    remotePatterns: [
      // Always allow localhost for development
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/**',
      },
      // Allow the configured site hostname
      ...(isLocalhost ? [] : [{
        protocol: 'https',
        hostname: siteHostname,
        pathname: '/**',
      }]),
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${backendPort}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `http://localhost:${backendPort}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
