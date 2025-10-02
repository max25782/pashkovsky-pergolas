export interface PergolaStep {
  id: string
  delay: number
  duration: number
  initial: {
    y: number
    opacity: number
    scale?: number
    rotateX?: number
  }
  animate: {
    y: number
    opacity: number
    scale?: number
    rotateX?: number
  }
}

export const pergolaSteps: PergolaStep[] = [
  // Stage 1: Foundation pieces
  {
    id: 'base-1',
    delay: 0.05,
    duration: 0.6,
    initial: { y: 20, opacity: 0, rotateX: 90 },
    animate: { y: 0, opacity: 1, rotateX: 0 }
  },
  {
    id: 'base-2',
    delay: 0.13,
    duration: 0.6,
    initial: { y: 20, opacity: 0, rotateX: 90 },
    animate: { y: 0, opacity: 1, rotateX: 0 }
  },
  {
    id: 'base-3',
    delay: 0.21,
    duration: 0.6,
    initial: { y: 20, opacity: 0, rotateX: 90 },
    animate: { y: 0, opacity: 1, rotateX: 0 }
  },
  {
    id: 'base-4',
    delay: 0.29,
    duration: 0.6,
    initial: { y: 20, opacity: 0, rotateX: 90 },
    animate: { y: 0, opacity: 1, rotateX: 0 }
  },
  
  // Stage 2: Posts rise
  {
    id: 'post-1',
    delay: 0.5,
    duration: 0.8,
    initial: { y: 100, opacity: 0, scale: 0.8 },
    animate: { y: 0, opacity: 1, scale: 1 }
  },
  {
    id: 'post-2',
    delay: 0.58,
    duration: 0.8,
    initial: { y: 100, opacity: 0, scale: 0.8 },
    animate: { y: 0, opacity: 1, scale: 1 }
  },
  {
    id: 'post-3',
    delay: 0.66,
    duration: 0.8,
    initial: { y: 100, opacity: 0, scale: 0.8 },
    animate: { y: 0, opacity: 1, scale: 1 }
  },
  {
    id: 'post-4',
    delay: 0.74,
    duration: 0.8,
    initial: { y: 100, opacity: 0, scale: 0.8 },
    animate: { y: 0, opacity: 1, scale: 1 }
  },
  
  // Stage 3: Beams connect
  {
    id: 'beam-horizontal-1',
    delay: 1.2,
    duration: 0.7,
    initial: { y: -20, opacity: 0, scale: 0.5 },
    animate: { y: 0, opacity: 1, scale: 1 }
  },
  {
    id: 'beam-horizontal-2',
    delay: 1.28,
    duration: 0.7,
    initial: { y: -20, opacity: 0, scale: 0.5 },
    animate: { y: 0, opacity: 1, scale: 1 }
  },
  
  // Stage 4: Roof slats
  {
    id: 'slat-1',
    delay: 1.7,
    duration: 0.5,
    initial: { y: -30, opacity: 0 },
    animate: { y: 0, opacity: 1 }
  },
  {
    id: 'slat-2',
    delay: 1.75,
    duration: 0.5,
    initial: { y: -30, opacity: 0 },
    animate: { y: 0, opacity: 1 }
  },
  {
    id: 'slat-3',
    delay: 1.8,
    duration: 0.5,
    initial: { y: -30, opacity: 0 },
    animate: { y: 0, opacity: 1 }
  },
  {
    id: 'slat-4',
    delay: 1.85,
    duration: 0.5,
    initial: { y: -30, opacity: 0 },
    animate: { y: 0, opacity: 1 }
  },
  {
    id: 'slat-5',
    delay: 1.9,
    duration: 0.5,
    initial: { y: -30, opacity: 0 },
    animate: { y: 0, opacity: 1 }
  },
  {
    id: 'slat-6',
    delay: 1.95,
    duration: 0.5,
    initial: { y: -30, opacity: 0 },
    animate: { y: 0, opacity: 1 }
  }
]


