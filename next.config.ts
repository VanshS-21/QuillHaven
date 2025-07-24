import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Additional optimizations
  poweredByHeader: false,
  
  // Image optimization for Docker
  images: {
    unoptimized: true,
  },
}

export default nextConfig
