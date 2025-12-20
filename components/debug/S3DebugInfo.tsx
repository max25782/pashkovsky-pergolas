/**
 * Debug component to check S3 configuration
 * Add this temporarily to see what URLs are being generated
 */

'use client'

import { getImageUrl } from '@/lib/image-url-client'
import { useEffect } from 'react'

export function S3DebugInfo() {
  useEffect(() => {
    console.log('=== S3 Debug Info ===')
    console.log('NEXT_PUBLIC_AWS_S3_BUCKET_NAME:', process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME)
    console.log('NEXT_PUBLIC_AWS_S3_REGION:', process.env.NEXT_PUBLIC_AWS_S3_REGION)
    
    const testPaths = [
      '/images/logos/beit amana.jpg',
      '/hero/photo_2025-10-03_22-07-08_merged.mp4',
      '/images/services/pergola.webp'
    ]
    
    testPaths.forEach(path => {
      const url = getImageUrl(path)
      console.log(`getImageUrl("${path}") = "${url}"`)
    })
    console.log('====================')
  }, [])
  
  return null
}




