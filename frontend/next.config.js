/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Required for Docker
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.ethos.network',
      },
    ],
  },
}

module.exports = nextConfig
