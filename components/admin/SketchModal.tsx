"use client"

import { useEffect, useRef, useState } from 'react'
import { Save, Trash2, Undo2, Square, Circle, Minus, Grid, CircleDot, Edit3 } from 'lucide-react'

interface SketchModalProps {
  dealId: string
  existingImageUrl?: string | null
  existingJson?: any
  onClose: () => void
  onSave: (imageBlob: Blob, jsonData: any) => Promise<void>
  adminToken: string
}

type DrawingTool = 'pencil' | 'dot' | 'rectangle' | 'circle' | 'line' | 'pergola-rect' | 'pergola-l' | 'pergola-custom'

export function SketchModal({ dealId, existingImageUrl, existingJson, onClose, onSave, adminToken }: SketchModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<any>(null)
  const fabricRef = useRef<any>(null)
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef<number>(-1)
  
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pencil')
  const [historyLength, setHistoryLength] = useState(0)
  const [saving, setSaving] = useState(false)
  const [isReady, setIsReady] = useState(false)

  // Сохранение состояния в историю
  const saveHistory = () => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    
    const json = JSON.stringify(canvas.toJSON())
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1)
    newHistory.push(json)
    
    if (newHistory.length > 30) newHistory.shift()
    
    historyRef.current = newHistory
    historyIndexRef.current = newHistory.length - 1
    setHistoryLength(newHistory.length)
  }

  // Инициализация Fabric.js и canvas
  useEffect(() => {
    if (!canvasRef.current) {
      console.log('[Sketch] No canvas ref')
      return
    }

    let mounted = true
    console.log('[Sketch] Starting fabric import')

    import('fabric').then((fabricModule: any) => {
      if (!mounted || !canvasRef.current) {
        console.log('[Sketch] Component unmounted or no canvas ref')
        return
      }
      
      console.log('[Sketch] Fabric module loaded', fabricModule)
      
      // Fabric.js 4.x exports fabric object directly
      const fabric = fabricModule.fabric || fabricModule.default || fabricModule
      console.log('[Sketch] Fabric object', fabric)
      console.log('[Sketch] Fabric.Canvas exists?', !!fabric.Canvas)
      
      fabricRef.current = fabric
      
      const isMobile = window.innerWidth < 768
      const width = isMobile ? Math.min(window.innerWidth - 40, 800) : 800
      const height = isMobile ? Math.min(window.innerHeight * 0.5, 500) : 500

      console.log('[Sketch] Creating canvas', { width, height })

      try {
        const canvas = new fabric.Canvas(canvasRef.current, {
          width,
          height,
          backgroundColor: '#ffffff',
          isDrawingMode: true,
          selection: false,
        })

        console.log('[Sketch] Canvas created', canvas)
        console.log('[Sketch] isDrawingMode:', canvas.isDrawingMode)
        console.log('[Sketch] freeDrawingBrush:', canvas.freeDrawingBrush)

        // Настройка кисти
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.width = 3
          canvas.freeDrawingBrush.color = '#000000'
          console.log('[Sketch] Brush configured')
        } else {
          console.warn('[Sketch] No freeDrawingBrush!')
        }

        fabricCanvasRef.current = canvas

        // Загрузка существующих данных
        if (existingJson) {
          const jsonData = typeof existingJson === 'string' ? existingJson : JSON.stringify(existingJson)
          console.log('[Sketch] Loading existing JSON')
          canvas.loadFromJSON(jsonData, () => {
            canvas.renderAll()
            saveHistory()
            setIsReady(true)
          })
        } else {
          console.log('[Sketch] No existing data, ready')
          saveHistory()
          setIsReady(true)
        }

        // Сохранение после каждого рисования
        canvas.on('path:created', (e: any) => {
          console.log('[Sketch] path:created event', e)
          saveHistory()
        })

        canvas.on('object:added', (e: any) => {
          console.log('[Sketch] object:added event', e.target?.type)
          if (e.target && e.target.type !== 'path') {
            if (!e.target._isTemp) {
              saveHistory()
            }
          }
        })
        
        canvas.on('mouse:down', (e: any) => {
          console.log('[Sketch] mouse:down on canvas', { isDrawingMode: canvas.isDrawingMode })
        })
        
        canvas.on('mouse:up', (e: any) => {
          console.log('[Sketch] mouse:up on canvas', { objectsCount: canvas.getObjects().length })
        })
        
      } catch (err) {
        console.error('[Sketch] Error creating canvas:', err)
      }
    }).catch(err => {
      console.error('[Sketch] Error importing fabric:', err)
    })

    return () => {
      mounted = false
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose()
        fabricCanvasRef.current = null
      }
    }
  }, [existingJson])

  // Переключение инструментов
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    const fabric = fabricRef.current
    if (!canvas || !fabric) return

    const isPencil = currentTool === 'pencil'
    canvas.isDrawingMode = isPencil

    if (isPencil && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = 3
      canvas.freeDrawingBrush.color = '#000000'
    }

    // Удаляем старые обработчики
    canvas.off('mouse:down')
    canvas.off('mouse:move')
    canvas.off('mouse:up')

    if (!isPencil) {
      let isDrawing = false
      let startPoint: { x: number; y: number } | null = null
      let tempObject: any = null

      const onMouseDown = (e: any) => {
        const pointer = canvas.getPointer(e.e)
        
        if (currentTool === 'dot') {
          const dot = new fabric.Circle({
            left: pointer.x - 5,
            top: pointer.y - 5,
            radius: 5,
            fill: '#000000',
            selectable: false,
            evented: false,
          })
          canvas.add(dot)
          canvas.renderAll()
          saveHistory()
          return
        }

        startPoint = pointer
        isDrawing = true
      }

      const onMouseMove = (e: any) => {
        if (!isDrawing || !startPoint) return

        const pointer = canvas.getPointer(e.e)
        
        // Удаляем временный объект
        if (tempObject) {
          canvas.remove(tempObject)
          tempObject = null
        }

        const left = Math.min(startPoint.x, pointer.x)
        const top = Math.min(startPoint.y, pointer.y)
        const width = Math.abs(pointer.x - startPoint.x)
        const height = Math.abs(pointer.y - startPoint.y)

        switch (currentTool) {
          case 'rectangle':
            tempObject = new fabric.Rect({
              left, top, width, height,
              fill: 'transparent',
              stroke: '#000000',
              strokeWidth: 2,
              selectable: false,
            })
            break
          case 'circle':
            const radius = Math.sqrt(width * width + height * height) / 2
            tempObject = new fabric.Circle({
              left: startPoint.x - radius,
              top: startPoint.y - radius,
              radius,
              fill: 'transparent',
              stroke: '#000000',
              strokeWidth: 2,
              selectable: false,
            })
            break
          case 'line':
            tempObject = new fabric.Line(
              [startPoint.x, startPoint.y, pointer.x, pointer.y],
              { stroke: '#000000', strokeWidth: 2, selectable: false }
            )
            break
          case 'pergola-rect':
          case 'pergola-l':
          case 'pergola-custom':
            tempObject = new fabric.Rect({
              left, top, width, height,
              fill: 'rgba(139, 69, 19, 0.1)',
              stroke: '#8B4513',
              strokeWidth: 2,
              selectable: false,
            })
            break
        }

        if (tempObject) {
          tempObject._isTemp = true
          canvas.add(tempObject)
          canvas.renderAll()
        }
      }

      const onMouseUp = () => {
        if (!isDrawing) return
        isDrawing = false

        if (tempObject) {
          delete tempObject._isTemp
          canvas.renderAll()
          saveHistory()
        }

        startPoint = null
        tempObject = null
      }

      canvas.on('mouse:down', onMouseDown)
      canvas.on('mouse:move', onMouseMove)
      canvas.on('mouse:up', onMouseUp)
    }
  }, [currentTool])

  const handleUndo = () => {
    const canvas = fabricCanvasRef.current
    if (!canvas || historyIndexRef.current <= 0) return

    historyIndexRef.current--
    const prevState = historyRef.current[historyIndexRef.current]
    
    canvas.loadFromJSON(prevState, () => {
      canvas.renderAll()
      setHistoryLength(historyRef.current.length)
    })
  }

  const handleClear = () => {
    const canvas = fabricCanvasRef.current
    if (!canvas || !confirm('Очистить весь рисунок?')) return

    canvas.clear()
    canvas.backgroundColor = '#ffffff'
    canvas.renderAll()
    
    historyRef.current = []
    historyIndexRef.current = -1
    saveHistory()
  }

  const handleSave = async () => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    setSaving(true)
    try {
      const jsonData = canvas.toJSON()
      const dataURL = canvas.toDataURL({ format: 'png', quality: 1 })
      const response = await fetch(dataURL)
      const blob = await response.blob()
      
      await onSave(blob, jsonData)
      onClose()
    } catch (error) {
      console.error('Error saving sketch:', error)
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const tools = [
    { id: 'pencil', icon: Edit3, label: 'Карандаш' },
    { id: 'dot', icon: CircleDot, label: 'Точка' },
    { id: 'rectangle', icon: Square, label: 'Прямоугольник' },
    { id: 'circle', icon: Circle, label: 'Круг' },
    { id: 'line', icon: Minus, label: 'Линия' },
  ]

  const pergolaTools = [
    { id: 'pergola-rect', label: 'Пергола ▭' },
    { id: 'pergola-l', label: 'Пергола Г' },
    { id: 'pergola-custom', label: 'Пергола ✏️' },
  ]

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-white/20 rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Эскиз проекта</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-gray-800/50 flex-wrap">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setCurrentTool(id as DrawingTool)}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-all ${
                currentTool === id 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          
          <div className="w-px h-6 bg-white/20 mx-1" />
          
          {pergolaTools.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setCurrentTool(id as DrawingTool)}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-all ${
                currentTool === id 
                  ? 'bg-amber-600 text-white shadow-lg' 
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          
          <div className="flex-1" />
          
          <button 
            onClick={handleUndo}
            disabled={historyIndexRef.current <= 0}
            className="px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Undo2 className="w-4 h-4" />
            <span className="hidden sm:inline">Отменить</span>
          </button>
          
          <button 
            onClick={handleClear}
            className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Очистить</span>
          </button>
          
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4 bg-gray-800/30 flex items-center justify-center relative">
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
              <div className="text-white">Загрузка...</div>
            </div>
          )}
          <div className="relative border-2 border-white/20 rounded-lg shadow-xl overflow-hidden">
            <canvas 
              ref={canvasRef}
              style={{ touchAction: 'none', display: 'block' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
