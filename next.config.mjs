/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/supabase-api/:path*',
        destination: 'http://127.0.0.1:8010/:path*',
      },
    ]
  },
}

export default nextConfig
