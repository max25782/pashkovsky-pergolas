declare module 'fabric' {
  export class Canvas {
    constructor(element: HTMLCanvasElement | string, options?: any)
    width: number | null
    height: number | null
    backgroundColor: string
    isDrawingMode: boolean
    freeDrawingBrush: {
      width: number
      color: string
    }
    getObjects(): Object[]
    getPointer(e: any): { x: number; y: number }
    add(object: Object): void
    remove(object: Object): void
    clear(): void
    renderAll(): void
    toJSON(propertiesToInclude?: string[]): string
    loadFromJSON(json: string, callback: () => void): void
    toDataURL(options?: { format?: string; quality?: number }): string
    dispose(): void
    on(event: string, handler: (e: any) => void): void
    defaultCursor: string
  }

  export class Object {
    name?: string
    left: number
    top: number
  }

  export class Rect extends Object {
    constructor(options: {
      left: number
      top: number
      width: number
      height: number
      fill?: string
      stroke?: string
      strokeWidth?: number
      name?: string
    })
  }

  export class Circle extends Object {
    constructor(options: {
      left: number
      top: number
      radius: number
      fill?: string
      stroke?: string
      strokeWidth?: number
      name?: string
    })
  }

  export class Line extends Object {
    constructor(points: number[], options: {
      stroke?: string
      strokeWidth?: number
      name?: string
    })
  }

  export class Image extends Object {
    static fromURL(url: string, callback: (img: Image) => void): void
    scaleToWidth(width: number): void
  }

  export class Group extends Object {
    constructor(objects: Object[], options?: any)
    addWithUpdate(object: Object): void
  }

  export class Path extends Object {
    constructor(path: string, options?: any)
  }

  export const fabric: {
    Canvas: typeof Canvas
    Rect: typeof Rect
    Circle: typeof Circle
    Line: typeof Line
    Image: typeof Image
    Group: typeof Group
    Path: typeof Path
  }
}







