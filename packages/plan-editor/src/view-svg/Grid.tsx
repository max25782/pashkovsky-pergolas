interface GridProps {
  widthPx: number
  heightPx: number
}

const GRID_STEP_PX = 24

/** Простая клетчатая сетка на фоне — чисто декоративный слой, ничего не вычисляет. */
export function Grid({ widthPx, heightPx }: GridProps) {
  return (
    <>
      <defs>
        <pattern id="plan-editor-grid" width={GRID_STEP_PX} height={GRID_STEP_PX} patternUnits="userSpaceOnUse">
          <path
            d={`M ${GRID_STEP_PX} 0 L 0 0 0 ${GRID_STEP_PX}`}
            fill="none"
            stroke="#1f2937"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect x={0} y={0} width={widthPx} height={heightPx} fill="url(#plan-editor-grid)" />
    </>
  )
}
