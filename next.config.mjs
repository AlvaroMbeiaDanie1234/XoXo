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
        destination: 'http://204.168.143.175:8010/:path*',
      },
    ]
  },
}

export default nextConfig
