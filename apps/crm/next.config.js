/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['framer-motion'],
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    // Support S3 remote images if configured
    remotePatterns: [
      // AWS S3 server-side config
      ...(process.env.AWS_S3_BUCKET_NAME ? [{
        protocol: 'https',
        hostname: `${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION || 'us-east-1'}.amazonaws.com`,
        port: '',
        pathname: '/**',
      }] : []),
      // AWS S3 client-side public config
      ...(process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME ? [{
        protocol: 'https',
        hostname: `${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_S3_REGION || 'us-east-1'}.amazonaws.com`,
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

