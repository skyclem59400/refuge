import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['puppeteer', '@remotion/renderer', '@remotion/bundler'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zzevrtrgtgnlxxuwbnge.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'app.hunimalis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.hunimalis.com',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      { source: '/health', destination: '/sante', permanent: true },
      { source: '/health/protocols', destination: '/sante/protocols', permanent: true },
      { source: '/planning-veto', destination: '/sante/planning', permanent: true },
      { source: '/planning-veto/nouveau', destination: '/sante/planning/nouveau', permanent: true },
      { source: '/planning-veto/:id', destination: '/sante/planning/:id', permanent: true },
      { source: '/passages-veto', destination: '/sante/passages', permanent: true },
    ]
  },
};

export default nextConfig;
