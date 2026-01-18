/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  transpilePackages: ['framer-motion'],
  webpack: (config) => {
    // Ensure proper path resolution for @ alias
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    return config
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    // Support S3 remote images if configured
    remotePatterns: [
      // Wildcard for all S3 buckets (simplest for gallery)
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      // Specific bucket patterns (fallback)
      ...(process.env.AWS_S3_BUCKET_NAME ? [{
        protocol: 'https',
        hostname: `${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION || 'eu-north-1'}.amazonaws.com`,
        port: '',
        pathname: '/**',
      }] : []),
      ...(process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME ? [{
        protocol: 'https',
        hostname: `${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'}.amazonaws.com`,
        port: '',
        pathname: '/**',
      }] : []),
      // Supabase Storage (for admin gallery)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}
module.exports = nextConfig

