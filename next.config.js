/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingExcludes: {
    '/*': [
      '.next/cache/**/*',
      '.next/cache/webpack/**/*',
      'logs/**/*',
      'coverage/**/*',
      'node_modules/.cache/**/*',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
}

module.exports = nextConfig
