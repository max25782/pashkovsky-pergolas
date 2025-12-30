export interface ImageData {
  id?: string
  src: string
  alt?: string
  title?: string
  desc?: string
  width?: number
  height?: number
}

export interface MediaItem {
  src: string
  type: 'image' | 'video'
  alt?: string
  title?: string
}

export interface ImagesCollection {
  gallery: ImageData[]
  [key: string]: ImageData[]
}

