import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['puppeteer', '@remotion/renderer', '@remotion/bundler'],
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
};

export default nextConfig;
