/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // Allow the Next.js app to proxy API calls to the Flask backend
    // Configure backend URL via NEXT_PUBLIC_API_PROXY or default to localhost:5000
    const backend = process.env.NEXT_PUBLIC_API_PROXY || 'http://localhost:5000'
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
