/**
 * Custom loader for Next.js Image component to handle S3 URLs
 * This prevents Next.js from trying to optimize external S3 images incorrectly
 */

export function s3ImageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  // If it's already an S3 URL (starts with https://), return as is
  if (src.startsWith('https://')) {
    return src
  }
  
  // If it's a local path and S3 is configured, convert to S3 URL
  const USE_S3 = !!(process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME && process.env.NEXT_PUBLIC_AWS_S3_REGION)
  const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || ''
  const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'us-east-1'
  
  if (USE_S3 && S3_BUCKET && src.startsWith('/')) {
    const cleanPath = src.slice(1) // Remove leading slash
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${cleanPath}`
  }
  
  // Fallback to Next.js default optimization for local images
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`
}




