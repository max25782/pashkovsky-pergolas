import { createRoot } from 'react-dom/client'
import {
  buildPieces,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  specFromPlan,
  type SupportType,
} from '@pashkovsky/pergola-core'
import type { Point2D, ProfileDimensions } from '@pashkovsky/pergola-core'
import { PergolaCutPieceViewer } from '../src/PergolaCutPieceViewer'

const RECT: Point2D[] = [
  [0, 0],
  [6000, 0],
  [6000, 4000],
  [0, 4000],
]

const L_SHAPE: Point2D[] = [
  [0, 0],
  [6000, 0],
  [6000, 2500],
  [3000, 2500],
  [3000, 4000],
  [0, 4000],
]

const PROFILES: Map<string, ProfileDimensions> = new Map([
  ['f8080', { widthMm: 80, heightMm: 80, availableStockLengthsMm: [4000, 6000] }],
  ['f10040', { widthMm: 40, heightMm: 100, maxSpanMm: 3000, availableStockLengthsMm: [6000, 7000] }],
  ['f7020', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
  ['purlin-led-6040', {
    widthMm: 40,
    heightMm: 60,
    maxSpanMm: 3000,
    interruptsLamella: true,
    hasLedChannel: true,
    availableStockLengthsMm: [6000],
  }],
])

const params = new URLSearchParams(window.location.search)
const shape = params.get('shape') === 'l' ? 'l' : 'rect'
const mode = (params.get('mode') ?? 'free-standing') as SupportType
const angle = params.get('angle') === '45' ? 45 : 0
const color = params.get('color') ?? 'RAL7016'
const scene = params.get('scene') === 'courtyard' ? 'courtyard' : 'classic'

const contour = shape === 'l' ? L_SHAPE : RECT
const wallEdgeIndices = mode === 'wall-mounted' ? (shape === 'l' ? [4, 5] : [0]) : []

const spec = specFromPlan({
  contour,
  wallEdgeIndices,
  params: {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    heightMm: 2600,
    lamellaAngleDeg: angle,
    colorHex: color,
    supportType: mode === 'posts' ? 'free-standing' : (mode === 'wall-mounted' || mode === 'hanging' ? mode : 'free-standing'),
    beamProfileId: 'f10040',
    postProfileId: 'f8080',
    lamellaPatternId: 'all-70',
    purlinProfileId: 'purlin-led-6040',
  },
})

const built = buildPieces(spec, PROFILES)

function App() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        data-testid="scene-label"
        style={{
          padding: '8px 12px',
          color: '#fff',
          background: '#111',
          fontSize: 13,
        }}
      >
        {shape === 'l' ? 'L-shape' : '600×400'} · {spec.supportType} · {spec.heightMm}mm · {spec.colorHex} · {spec.lamellaAngleDeg}°
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PergolaCutPieceViewer
          pieces={built.pieces}
          profiles={PROFILES}
          colorHex={spec.colorHex}
          scenePreset={scene}
        />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
