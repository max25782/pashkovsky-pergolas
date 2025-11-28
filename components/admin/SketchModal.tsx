"use client"

import { useEffect, useRef, useState } from 'react'
import { X, Save, Trash2, Undo2, Square, Circle, Minus, Grid } from 'lucide-react'

interface SketchModalProps {
  dealId: string
  existingImageUrl?: string | null
  existingJson?: any
  onClose: () => void
  onSave: (imageBlob: Blob, jsonData: any) => Promise<void>
  adminToken: string
}

type DrawingTool = 'pencil' | 'rectangle' | 'circle' | 'line' | 'pergola-rect' | 'pergola-l'

export function SketchModal({
  dealId,
  existingImageUrl,
  existingJson,
  onClose,
  onSave,
  adminToken
}: SketchModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<any>(null)
  const fabricRef = useRef<any>(null)
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pencil')
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [saving, setSaving] = useState(false)
  const [fabricLoaded, setFabricLoaded] = useState(false)

  // Load fabric.js dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return

    import('fabric').then((fabricModule) => {
      fabricRef.current = fabricModule.fabric
      setFabricLoaded(true)
    }).catch((error) => {
      console.error('Failed to load fabric.js:', error)
    })
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !fabricRef.current || !fabricLoaded) return

    const fabric = fabricRef.current

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
      isDrawingMode: currentTool === 'pencil'
    })

    // Configure drawing brush
    canvas.freeDrawingBrush.width = 3
    canvas.freeDrawingBrush.color = '#000000'

    // Load existing sketch if available
    if (existingJson) {
      canvas.loadFromJSON(existingJson, () => {
        canvas.renderAll()
        saveState()
      })
    } else if (existingImageUrl) {
      fabric.Image.fromURL(existingImageUrl, (img: any) => {
        img.scaleToWidth(canvas.width!)
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas))
        saveState()
      })
    } else {
      saveState()
    }

    // Handle object creation
    canvas.on('mouse:down', (e: any) => {
      if (currentTool === 'pencil') return
      
      const pointer = canvas.getPointer(e.e)
      setStartPoint(pointer)
      setIsDrawing(true)
    })

    canvas.on('mouse:move', (e: any) => {
      if (!isDrawing || !startPoint) return
      
      const pointer = canvas.getPointer(e.e)
      
      // Remove temporary object if exists
      const objects = canvas.getObjects()
      const tempObj = objects[objects.length - 1]
      if (tempObj && tempObj.name === 'temp') {
        canvas.remove(tempObj)
      }

      let obj: any = null

      switch (currentTool) {
        case 'rectangle':
          obj = new fabric.Rect({
            left: Math.min(startPoint.x, pointer.x),
            top: Math.min(startPoint.y, pointer.y),
            width: Math.abs(pointer.x - startPoint.x),
            height: Math.abs(pointer.y - startPoint.y),
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
            name: 'temp'
          })
          break
        case 'circle':
          const radius = Math.sqrt(
            Math.pow(pointer.x - startPoint.x, 2) + Math.pow(pointer.y - startPoint.y, 2)
          ) / 2
          obj = new fabric.Circle({
            left: startPoint.x - radius,
            top: startPoint.y - radius,
            radius,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
            name: 'temp'
          })
          break
        case 'line':
          obj = new fabric.Line(
            [startPoint.x, startPoint.y, pointer.x, pointer.y],
            {
              stroke: '#000000',
              strokeWidth: 2,
              name: 'temp'
            }
          )
          break
        case 'pergola-rect':
          obj = createPergolaRect(fabric, startPoint, pointer)
          break
        case 'pergola-l':
          obj = createPergolaL(fabric, startPoint, pointer)
          break
      }

      if (obj) {
        canvas.add(obj)
        canvas.renderAll()
      }
    })

    canvas.on('mouse:up', () => {
      if (!isDrawing) return
      
      setIsDrawing(false)
      
      // Remove 'temp' name and save state
      const objects = canvas.getObjects()
      const lastObj = objects[objects.length - 1]
      if (lastObj && lastObj.name === 'temp') {
        lastObj.name = ''
        saveState()
      }
      
      setStartPoint(null)
    })

    // Save state on object modification
    canvas.on('object:modified', saveState)
    canvas.on('object:added', saveState)
    canvas.on('object:removed', saveState)

    fabricCanvasRef.current = canvas

    function saveState() {
      if (!canvas) return
      
      const json = JSON.stringify(canvas.toJSON())
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(json)
      
      // Keep only last 20 states
      if (newHistory.length > 20) {
        newHistory.shift()
      } else {
        setHistoryIndex(newHistory.length - 1)
      }
      
      setHistory(newHistory)
    }

    return () => {
      canvas.dispose()
    }
  }, [fabricLoaded, currentTool, isDrawing, startPoint, history, historyIndex])

  useEffect(() => {
    if (!fabricCanvasRef.current) return
    
    fabricCanvasRef.current.isDrawingMode = currentTool === 'pencil'
    
    if (currentTool === 'pencil') {
      fabricCanvasRef.current.defaultCursor = 'crosshair'
    } else {
      fabricCanvasRef.current.defaultCursor = 'default'
    }
  }, [currentTool])

  function handleUndo() {
    if (historyIndex <= 0 || !fabricCanvasRef.current) return
    
    const prevIndex = historyIndex - 1
    const prevState = history[prevIndex]
    
    fabricCanvasRef.current.loadFromJSON(prevState, () => {
      fabricCanvasRef.current?.renderAll()
      setHistoryIndex(prevIndex)
    })
  }

  function handleClear() {
    if (!fabricCanvasRef.current) return
    if (!confirm('Очистить весь рисунок?')) return
    
    fabricCanvasRef.current.clear()
    fabricCanvasRef.current.backgroundColor = '#ffffff'
    fabricCanvasRef.current.renderAll()
    const json = JSON.stringify(fabricCanvasRef.current.toJSON())
    setHistory([json])
    setHistoryIndex(0)
  }

  async function handleSave() {
    if (!fabricCanvasRef.current) return
    
    setSaving(true)
    try {
      // Get JSON data
      const jsonData = fabricCanvasRef.current.toJSON()
      
      // Convert canvas to blob
      const dataURL = fabricCanvasRef.current.toDataURL({
        format: 'png',
        quality: 1
      })
      
      const blob = await (await fetch(dataURL)).blob()
      
      await onSave(blob, jsonData)
      onClose()
    } catch (error) {
      console.error('Failed to save sketch:', error)
      alert('Ошибка при сохранении эскиза')
    } finally {
      setSaving(false)
    }
  }

  function createPergolaRect(fabric: any, start: { x: number; y: number }, end: { x: number; y: number }) {
    const group = new fabric.Group([], {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      name: 'temp'
    })

    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    const gridSize = 20

    // Outer rectangle
    const rect = new fabric.Rect({
      left: 0,
      top: 0,
      width,
      height,
      fill: 'rgba(139, 69, 19, 0.1)',
      stroke: '#8B4513',
      strokeWidth: 2
    })
    group.addWithUpdate(rect)

    // Grid lines
    for (let i = gridSize; i < width; i += gridSize) {
      const line = new fabric.Line([i, 0, i, height], {
        stroke: '#8B4513',
        strokeWidth: 1,
        strokeDashArray: [5, 5]
      })
      group.addWithUpdate(line)
    }

    for (let i = gridSize; i < height; i += gridSize) {
      const line = new fabric.Line([0, i, width, i], {
        stroke: '#8B4513',
        strokeWidth: 1,
        strokeDashArray: [5, 5]
      })
      group.addWithUpdate(line)
    }

    return group
  }

  function createPergolaL(fabric: any, start: { x: number; y: number }, end: { x: number; y: number }) {
    const group = new fabric.Group([], {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      name: 'temp'
    })

    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    const gridSize = 20
    const legWidth = Math.min(width, height) * 0.4

    // L-shape path
    const path = new fabric.Path(
      `M 0 0 L ${width} 0 L ${width} ${legWidth} L ${legWidth} ${legWidth} L ${legWidth} ${height} L 0 ${height} Z`,
      {
        fill: 'rgba(139, 69, 19, 0.1)',
        stroke: '#8B4513',
        strokeWidth: 2
      }
    )
    group.addWithUpdate(path)

    // Grid lines
    for (let i = gridSize; i < width; i += gridSize) {
      const line = new fabric.Line([i, 0, i, legWidth], {
        stroke: '#8B4513',
        strokeWidth: 1,
        strokeDashArray: [5, 5]
      })
      group.addWithUpdate(line)
    }

    for (let i = gridSize; i < legWidth; i += gridSize) {
      const line = new fabric.Line([0, i, width, i], {
        stroke: '#8B4513',
        strokeWidth: 1,
        strokeDashArray: [5, 5]
      })
      group.addWithUpdate(line)
    }

    for (let i = gridSize; i < height; i += gridSize) {
      const line = new fabric.Line([0, i, legWidth, i], {
        stroke: '#8B4513',
        strokeWidth: 1,
        strokeDashArray: [5, 5]
      })
      group.addWithUpdate(line)
    }

    for (let i = gridSize; i < legWidth; i += gridSize) {
      const line = new fabric.Line([i, legWidth, i, height], {
        stroke: '#8B4513',
        strokeWidth: 1,
        strokeDashArray: [5, 5]
      })
      group.addWithUpdate(line)
    }

    return group
  }

  if (!fabricLoaded) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center">
        <div className="bg-gray-900 border border-white/20 rounded-xl p-8">
          <div className="text-white">Загрузка редактора...</div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-white/20 rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Эскиз проекта</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-4 border-b border-white/10 bg-gray-800/50 flex-wrap">
          <button
            onClick={() => setCurrentTool('pencil')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              currentTool === 'pencil' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <Minus className="w-4 h-4" />
            Карандаш
          </button>
          <button
            onClick={() => setCurrentTool('rectangle')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              currentTool === 'rectangle' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <Square className="w-4 h-4" />
            Прямоугольник
          </button>
          <button
            onClick={() => setCurrentTool('circle')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              currentTool === 'circle' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <Circle className="w-4 h-4" />
            Круг
          </button>
          <button
            onClick={() => setCurrentTool('line')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              currentTool === 'line' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <Minus className="w-4 h-4" />
            Линия
          </button>
          <div className="w-px h-6 bg-white/20 mx-2" />
          <button
            onClick={() => setCurrentTool('pergola-rect')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              currentTool === 'pergola-rect' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <Grid className="w-4 h-4" />
            Пергола ▭
          </button>
          <button
            onClick={() => setCurrentTool('pergola-l')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              currentTool === 'pergola-l' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <Grid className="w-4 h-4" />
            Пергола Г
          </button>
          <div className="flex-1" />
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="px-4 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Undo2 className="w-4 h-4" />
            Отменить
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Очистить
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4 bg-gray-800/30">
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="border border-white/20 rounded-lg shadow-lg bg-white"
              style={{ touchAction: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
