'use client'

/**
 * Production sheet for factory lamella sections.
 * Rectangles and the table both read `groupLamellaSectionTypes` — the same
 * cells as «פריסת למלות», grouped by W×H. Nothing is rebuilt.
 */

import { useMemo } from 'react'
import type { LamellaSection, LamellaSectionTypeGroup } from '@pashkovsky/pergola-core'
import { groupLamellaSectionTypes } from '@pashkovsky/pergola-core'

export interface LamellaSectionsSheetLabels {
  title: string
  type: string
  quantity: string
  size: string
  lamellasPerSection: string
  lamellaLength: string
  totalSections: string
  totalLamellas: string
  /** Footer count of section types, e.g. "Categories" / "קטגוריות". */
  categories: string
  /** Short quantity unit, e.g. "pcs" / "יח׳" / "шт.". */
  pieces: string
  /** Column heading for a trapezoid: row number, then that row's cut. */
  rowLengths: string
  /** Shown instead of the schedule when the shape has no sections. */
  noSections: string
}

const DEFAULT_LABELS: LamellaSectionsSheetLabels = {
  title: 'Lamella sections',
  type: 'Type',
  quantity: 'Qty',
  size: 'W×H mm',
  lamellasPerSection: 'Lamellas / section',
  lamellaLength: 'Lamella length mm',
  totalSections: 'Sections',
  totalLamellas: 'Lamellas',
  categories: 'Categories',
  pieces: 'pcs',
  rowLengths: 'Row → lamella length',
  noSections: 'No sections are calculated for this shape, see the lamella cut list',
}

export interface SectionTypeCard {
  typeId: string
  x: number
  y: number
  rectW: number
  rectH: number
  slotW: number
  /** Quantity, separate from the dimension lines ("9 pcs"). */
  label: string
  widthLabel: string
  heightLabel: string
  /** Set together when the type is a trapezoid: plan top, then plan bottom. */
  topWidthLabel?: string
  topRectW?: number
  botRectW?: number
  rowsLabel: string
  lengthLabel: string
  lamellaCountLabel: string
  overSpan: boolean
}

const CARD_FONT = 26
const LABEL_H = 108
const DIM_SIDE = 64
const HEIGHT_LABEL_GAP = 32
const CARD_GAP = 36

function labelWidthPx(label: string): number {
  return label.length * CARD_FONT * 0.58
}

/**
 * One scale for every type. Slots are at least as wide as the caption, so
 * “N × W × H” never runs into the next card.
 */
export function layoutSectionTypeCards(
  types: LamellaSectionTypeGroup[],
  area: { x: number; y: number; width: number; height: number },
): SectionTypeCard[] {
  if (types.length === 0) return []
  const maxHm = Math.max(...types.map((t) => t.heightMm))
  let scale = maxHm > 0 ? (area.height - LABEL_H) / maxHm : 1
  for (let attempt = 0; attempt < 14; attempt++) {
    const cards: SectionTypeCard[] = []
    let x = area.x
    let y = area.y
    let rowH = 0
    let rowStart = 0
    let fits = true
    const alignRowBottoms = (from: number) => {
      const bottom = Math.max(...cards.slice(from).map((card) => card.y + card.rectH))
      for (const card of cards.slice(from)) card.y = bottom - card.rectH
    }
    for (const type of types) {
      const trapezoid = type.widthAtHighMm != null && type.widthAtLowMm != null
        && Math.abs(type.widthAtHighMm - type.widthAtLowMm) > 0.5
      const topMm = trapezoid ? type.widthAtHighMm! : type.widthMm
      const botMm = trapezoid ? type.widthAtLowMm! : type.widthMm
      const topRectW = Math.max(8, topMm * scale)
      const botRectW = Math.max(8, botMm * scale)
      const rectW = Math.max(topRectW, botRectW)
      const rectH = Math.max(8, type.heightMm * scale)
      const widthLabel = shownMm(botMm)
      const topWidthLabel = trapezoid ? shownMm(topMm) : undefined
      const heightLabel = shownMm(type.heightMm)
      const label = `${type.count}`
      const lengthLabel = type.lamellaLengthLabel
        ? type.lamellaLengthLabel.split('/').map((part) => {
            const value = Number(part.trim())
            return Number.isFinite(value) ? shownMm(value) : part.trim()
          }).join(' / ')
        : shownMm(type.lamellaLengthMm)
      const rowsLabel = String(type.lamellasPerSection)
      const lamellaCountLabel = String(type.count * type.lamellasPerSection)
      const overSpan = (type.lamellaLengthsMm ?? [type.lamellaLengthMm]).some((length) => length > 1500)
      const fact = `${rowsLabel} · ${lengthLabel} · ${lamellaCountLabel}`
      const slotW = Math.max(rectW + DIM_SIDE, labelWidthPx(topWidthLabel ?? widthLabel) + DIM_SIDE, labelWidthPx(widthLabel) + DIM_SIDE, labelWidthPx(fact) + 28)
      if (x > area.x + 0.5 && x + slotW > area.x + area.width) {
        alignRowBottoms(rowStart)
        rowStart = cards.length
        x = area.x
        y += rowH + CARD_GAP
        rowH = 0
      }
      if (x + slotW > area.x + area.width + 0.5 || y + rectH + LABEL_H > area.y + area.height + 0.5) {
        fits = false
        break
      }
      cards.push({
        typeId: type.typeId,
        x,
        y,
        rectW,
        rectH,
        slotW,
        label,
        widthLabel,
        heightLabel,
        rowsLabel,
        lengthLabel,
        lamellaCountLabel,
        overSpan,
        ...(trapezoid ? { topWidthLabel, topRectW, botRectW } : {}),
      })
      x += slotW + CARD_GAP
      rowH = Math.max(rowH, rectH + LABEL_H)
    }
    if (fits && cards.length === types.length) {
      alignRowBottoms(rowStart)
      return cards
    }
    scale *= 0.82
  }
  return []
}

export function cardsOverlap(cards: SectionTypeCard[]): boolean {
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i]
      const b = cards[j]
      const aRight = a.x + a.slotW
      const aBottom = a.y + a.rectH + LABEL_H
      const bRight = b.x + b.slotW
      const bBottom = b.y + b.rectH + LABEL_H
      const separated = aRight <= b.x + 0.5 || bRight <= a.x + 0.5 || aBottom <= b.y + 0.5 || bBottom <= a.y + 0.5
      if (!separated) return true
    }
  }
  return false
}

function shownMm(mm: number): string {
  return String(Math.floor(mm + 0.005))
}

function shownSize(type: LamellaSectionTypeGroup): string {
  const height = shownMm(type.heightMm)
  if (
    type.widthAtHighMm != null &&
    type.widthAtLowMm != null &&
    Math.abs(type.widthAtHighMm - type.widthAtLowMm) > 0.5
  ) {
    return `${shownMm(type.widthAtHighMm)}/${shownMm(type.widthAtLowMm)}×${height}`
  }
  return `${shownMm(type.widthMm)}×${height}`
}
const SHEET_W = 1600
const SHEET_H = 1000
const LENGTH_TABLE_BOTTOM = 988

/** Several narrow columns so 54 row lengths stay inside the sheet. */
function lengthTableGrid(count: number, startY: number): { cols: number; rowPx: number; height: number; fits: boolean } {
  const available = LENGTH_TABLE_BOTTOM - startY
  const header = 36
  const rowPx = 34
  let rows = Math.max(1, Math.floor((available - header) / rowPx))
  let cols = Math.max(1, Math.ceil(count / rows))
  if (cols > 9) {
    cols = 9
    rows = Math.ceil(count / cols)
  }
  const height = header + rows * rowPx + 12
  return { cols, rowPx, height, fits: height <= available && rows * cols >= count }
}

function packTrapezoidPages(
  types: LamellaSectionTypeGroup[],
  firstStart: number,
): Array<{ types: LamellaSectionTypeGroup[]; startY: number }> {
  const tables = types.filter((type) => (type.lamellaLengthsMm?.length ?? 0) > 1)
  const pages: Array<{ types: LamellaSectionTypeGroup[]; startY: number }> = []
  let startY = firstStart
  let y = firstStart
  let bucket: LamellaSectionTypeGroup[] = []
  const flush = () => {
    if (bucket.length === 0) return
    pages.push({ types: bucket, startY })
    bucket = []
  }
  for (const type of tables) {
    const count = type.lamellaLengthsMm?.length ?? 0
    const grid = lengthTableGrid(count, y)
    if (!grid.fits) {
      flush()
      startY = 72
      y = 72
      const retry = lengthTableGrid(count, y)
      bucket = [type]
      y += retry.height
      continue
    }
    bucket.push(type)
    y += grid.height
  }
  flush()
  return pages
}

function TrapezoidRowTables({
  types,
  startY,
  title,
  rtl = false,
  fontFamily = 'sans-serif',
}: {
  types: LamellaSectionTypeGroup[]
  startY: number
  title: string
  rtl?: boolean
  fontFamily?: string
}) {
  let y = startY
  return (
    <g data-trapezoid-rows={types.length > 0 ? '1' : undefined}>
      {types.map((type) => {
        const lengths = type.lamellaLengthsMm ?? []
        const fromTop = [...lengths].reverse()
        const { cols, rowPx, height } = lengthTableGrid(fromTop.length, y)
        const colW = (SHEET_W - 96) / cols
        const rows = Math.ceil(fromTop.length / cols)
        const block = (
          <g key={type.typeId} data-trapezoid-type={type.typeId}>
            <text x={rtl ? SHEET_W - 88 : 48} y={y} textAnchor={rtl ? 'end' : 'start'} direction={rtl ? 'rtl' : 'ltr'} fontSize={26} fontWeight={700} fontFamily={fontFamily} fill="#44403c">
              {type.typeId} — {title}
            </text>
            {fromTop.map((length, index) => {
              const col = Math.floor(index / rows)
              const row = index % rows
              return (
                <text
                  key={index}
                  data-lamella-row={String(index + 1)}
                  data-lamella-row-length={String(length)}
                  x={(rtl ? SHEET_W - 48 : 48) + (rtl ? -1 : 1) * col * colW}
                  y={y + 40 + row * rowPx}
                  textAnchor={rtl ? 'end' : 'start'}
                  direction="ltr"
                  unicodeBidi="isolate"
                  fontSize={26}
                  fontFamily="monospace"
                  fill="#111827"
                >
                  {`${index + 1}  ${length}`}
                </text>
              )
            })}
          </g>
        )
        y += height
        return block
      })}
    </g>
  )
}

export interface LamellaSectionsSheetProps {
  sections: LamellaSection[]
  labels?: Partial<LamellaSectionsSheetLabels>
  className?: string
  /** Hebrew sheets read the schedule from the right. Numbers stay LTR. */
  dir?: 'rtl' | 'ltr'
  fontFamily?: string
  /** One SVG per printed page. Used by the production PDF. */
  flowPages?: boolean
  /**
   * Lamella length-by-row tables. Off on the production PDF.
   * The on-screen sheet keeps them unless this is set false.
   */
  showRowLengthAppendix?: boolean
}

export function LamellaSectionsSheet({
  sections,
  labels,
  className,
  dir = 'ltr',
  fontFamily = 'sans-serif',
  flowPages = false,
  showRowLengthAppendix,
}: LamellaSectionsSheetProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const schedule = useMemo(() => groupLamellaSectionTypes(sections), [sections])
  const bandCards = useMemo(
    () => layoutSectionTypeCards(schedule.types, { x: 48, y: 88, width: 1504, height: 420 }),
    [schedule],
  )
  const cards = useMemo(
    () => (bandCards.length > 0
      ? bandCards
      : layoutSectionTypeCards(schedule.types, { x: 48, y: 88, width: 1504, height: 780 })),
    [bandCards, schedule],
  )
  // No sections for this shape: the printed pack leaves the page out, the on-screen
  // sheet says why it is empty. The section builder is not involved.
  if (sections.length === 0) {
    if (flowPages) return null
    const emptyRtl = dir === 'rtl'
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
        <svg viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} style={{ background: '#ffffff', display: 'block', direction: 'ltr', unicodeBidi: 'isolate' }}>
          <text x={emptyRtl ? SHEET_W - 88 : 48} y={52} textAnchor={emptyRtl ? 'end' : 'start'} direction={emptyRtl ? 'rtl' : 'ltr'} fontSize={32} fontWeight={700} fontFamily={fontFamily} fill="#111827">
            {text.title}
          </text>
          <text
            data-sections-empty="1"
            x={emptyRtl ? SHEET_W - 88 : 48}
            y={120}
            textAnchor={emptyRtl ? 'end' : 'start'}
            direction={emptyRtl ? 'rtl' : 'ltr'}
            fontSize={28}
            fontFamily={fontFamily}
            fill="#44403c"
          >
            {text.noSections}
          </text>
        </svg>
      </div>
    )
  }
  const cardBottom = cards.reduce((max, card) => Math.max(max, card.y + card.rectH + 120), 88)
  const tableTop = bandCards.length > 0 ? 540 : Math.max(540, cardBottom + 16)
  const rowH = 36
  const contentH = tableTop + 44 + schedule.types.length * rowH + 88
  const sheetH = Math.max(SHEET_H, contentH)
  const rtl = dir === 'rtl'
  const columns = rtl ? [1512, 1340, 1080, 720, 380] : [48, 180, 340, 640, 1040]
  const anchor = rtl ? 'end' : 'start'
  const textDir = rtl ? 'rtl' : 'ltr'
  const summaryBottom = tableTop + 44 + schedule.types.length * rowH + 64
  const appendix = showRowLengthAppendix ?? !flowPages
  const trapezoidPages = appendix ? packTrapezoidPages(schedule.types, summaryBottom) : []
  const firstTables = trapezoidPages[0]?.startY === summaryBottom ? trapezoidPages[0] : null
  const extraTables = firstTables ? trapezoidPages.slice(1) : trapezoidPages
  const sheetStyle = { background: '#ffffff', display: 'block', direction: 'ltr' as const, unicodeBidi: 'isolate' as const }

  const page = (
    <svg
      className={flowPages ? undefined : 'h-full w-full'}
      viewBox={`0 0 ${SHEET_W} ${sheetH}`}
      style={{ background: '#ffffff', display: 'block', direction: 'ltr', unicodeBidi: 'isolate' }}
    >
      <text x={rtl ? SHEET_W - 88 : 48} y={52} textAnchor={anchor} direction={textDir} fontSize={32} fontWeight={700} fontFamily={fontFamily} fill="#111827">
        {text.title}
      </text>

      {cards.map((card) => {
        const rectX = card.x + Math.max(0, (card.slotW - DIM_SIDE - card.rectW) / 2)
        const dimY = card.y + card.rectH + 16
        const dimX = rectX + card.rectW + 22
        const midY = card.y + card.rectH / 2
        return (
          <g key={card.typeId}>
            {card.topRectW != null && card.botRectW != null ? (
              <polygon
                data-section-trapezoid="1"
                points={`${rectX},${card.y} ${rectX + card.topRectW},${card.y} ${rectX + card.botRectW},${card.y + card.rectH} ${rectX},${card.y + card.rectH}`}
                fill="#e7e5e4"
                stroke="#292524"
                strokeWidth={2}
              />
            ) : (
              <rect
                x={rectX}
                y={card.y}
                width={card.rectW}
                height={card.rectH}
                fill="#e7e5e4"
                stroke="#292524"
                strokeWidth={2}
              />
            )}
            {card.topWidthLabel ? (
              <text
                data-section-top={card.topWidthLabel}
                x={rectX + (card.topRectW ?? card.rectW) / 2}
                y={card.y - 8}
                textAnchor="middle"
                fontSize={CARD_FONT}
                fontWeight={700}
                fontFamily="sans-serif"
                fill="#111827"
              >
                {card.topWidthLabel}
              </text>
            ) : null}
            <text
              x={rectX + ((card.topRectW ?? card.rectW) + (card.botRectW ?? card.rectW)) / 4}
              y={card.y + card.rectH / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.min(64, Math.max(22, card.rectH * 0.28))}
              fontWeight={700}
              fontFamily="sans-serif"
              fill="#1c1917"
            >
              {card.typeId}
            </text>
            <line x1={rectX} y1={dimY} x2={rectX + (card.botRectW ?? card.rectW)} y2={dimY} stroke="#1f2937" strokeWidth={1.5} />
            <line x1={rectX} y1={dimY - 6} x2={rectX} y2={dimY + 6} stroke="#1f2937" strokeWidth={1.5} />
            <line x1={rectX + (card.botRectW ?? card.rectW)} y1={dimY - 6} x2={rectX + (card.botRectW ?? card.rectW)} y2={dimY + 6} stroke="#1f2937" strokeWidth={1.5} />
            <text
              data-section-width={card.widthLabel}
              x={rectX + (card.botRectW ?? card.rectW) / 2}
              y={dimY + 8}
              textAnchor="middle"
              dominantBaseline="hanging"
              fontSize={CARD_FONT}
              fontWeight={700}
              fontFamily="sans-serif"
              fill="#111827"
            >
              {card.widthLabel}
            </text>
            <text
              data-section-qty={`${card.label} ${text.pieces}`}
              x={rectX + card.rectW / 2}
              y={dimY + 36}
              textAnchor="middle"
              dominantBaseline="hanging"
              fontSize={CARD_FONT}
              fontFamily="sans-serif"
              fill="#44403c"
            >
              <tspan direction="ltr" unicodeBidi="isolate">{card.label}</tspan>
              {` ${text.pieces}`}
            </text>
            <text
              data-section-rows={card.rowsLabel}
              data-section-length={card.lengthLabel}
              data-section-lamellas={card.lamellaCountLabel}
              x={card.x + card.slotW / 2}
              y={dimY + 64}
              textAnchor="middle"
              dominantBaseline="hanging"
              direction="ltr"
              unicodeBidi="isolate"
              fontSize={24}
              fontFamily="monospace"
              fill="#111827"
            >
              {`${card.rowsLabel} · ${card.lengthLabel} · ${card.lamellaCountLabel}`}
            </text>
            {card.overSpan ? (
              <text
                data-over1500="1"
                x={card.x + card.slotW - 8}
                y={card.y - 6}
                textAnchor="end"
                direction="ltr"
                unicodeBidi="isolate"
                fontSize={22}
                fontWeight={700}
                fontFamily="sans-serif"
                fill="#b91c1c"
              >
                {'>1500'}
              </text>
            ) : null}
            <line x1={dimX} y1={card.y} x2={dimX} y2={card.y + card.rectH} stroke="#1f2937" strokeWidth={1.5} />
            <line x1={dimX - 6} y1={card.y} x2={dimX + 6} y2={card.y} stroke="#1f2937" strokeWidth={1.5} />
            <line x1={dimX - 6} y1={card.y + card.rectH} x2={dimX + 6} y2={card.y + card.rectH} stroke="#1f2937" strokeWidth={1.5} />
            <text
              data-section-height={card.heightLabel}
              data-height-gap={HEIGHT_LABEL_GAP}
              x={dimX + HEIGHT_LABEL_GAP}
              y={midY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={CARD_FONT}
              fontWeight={700}
              fontFamily="sans-serif"
              fill="#111827"
              transform={`rotate(-90, ${dimX + HEIGHT_LABEL_GAP}, ${midY})`}
            >
              {card.heightLabel}
            </text>
          </g>
        )
      })}

      <text x={columns[0]} y={tableTop} textAnchor={anchor} direction={textDir} fontSize={24} fontWeight={700} fontFamily={fontFamily} fill="#44403c">{text.type}</text>
      <text x={columns[1]} y={tableTop} textAnchor={anchor} direction={textDir} fontSize={24} fontWeight={700} fontFamily={fontFamily} fill="#44403c">{text.quantity}</text>
      <text x={columns[2]} y={tableTop} textAnchor={anchor} direction={textDir} fontSize={24} fontWeight={700} fontFamily={fontFamily} fill="#44403c">{text.size}</text>
      <text x={columns[3]} y={tableTop} textAnchor={anchor} direction={textDir} fontSize={24} fontWeight={700} fontFamily={fontFamily} fill="#44403c">{text.lamellasPerSection}</text>
      <text x={columns[4]} y={tableTop} textAnchor={anchor} direction={textDir} fontSize={24} fontWeight={700} fontFamily={fontFamily} fill="#44403c">{text.lamellaLength}</text>
      <line x1={48} y1={tableTop + 12} x2={1552} y2={tableTop + 12} stroke="#d6d3d1" strokeWidth={1} />

      {schedule.types.map((type, index) => {
        const y = tableTop + 44 + index * rowH
        return (
          <g key={type.typeId}>
            <text x={columns[0]} y={y} textAnchor={anchor} direction={textDir} fontSize={24} fontWeight={700} fontFamily={fontFamily} fill="#111827">{type.typeId}</text>
            <text x={columns[1]} y={y} textAnchor={anchor} direction="ltr" fontSize={24} fontFamily="sans-serif" fill="#111827">{type.count}</text>
            <text x={columns[2]} y={y} textAnchor={anchor} direction="ltr" fontSize={24} fontFamily="monospace" fill="#111827">{shownSize(type)}</text>
            <text x={columns[3]} y={y} textAnchor={anchor} direction="ltr" fontSize={24} fontFamily="sans-serif" fill="#111827">{type.lamellasPerSection}</text>
            <text x={columns[4]} y={y} textAnchor={anchor} direction="ltr" fontSize={24} fontFamily="monospace" fill="#111827">{type.lamellaLengthLabel ? type.lamellaLengthLabel.split('/').map((part) => shownMm(Number(part))).join(' / ') : shownMm(type.lamellaLengthMm)}</text>
          </g>
        )
      })}

      {rtl ? (
        <g data-section-footer="1">
          {(() => {
            const parts = [
              `${text.totalLamellas}:`,
              String(schedule.totalLamellas),
              '·',
              `${text.totalSections}:`,
              String(schedule.totalSections),
            ]
            let right = SHEET_W - 64
            const y = tableTop + 44 + schedule.types.length * rowH + 28
            return parts.map((part) => {
              const width = Math.max(20, [...part].reduce((sum, ch) => sum + (/[\u0590-\u05FF]/.test(ch) ? 26 : 16), 0))
              const x = right - width / 2
              right -= width + 36
              const hebrew = /[\u0590-\u05FF]/.test(part)
              return (
                <text
                  key={`${part}-${x}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  direction={hebrew ? 'rtl' : 'ltr'}
                  unicodeBidi="isolate"
                  fontSize={24}
                  fontWeight={700}
                  fontFamily={fontFamily}
                  fill="#111827"
                >
                  {part}
                </text>
              )
            })
          })()}
        </g>
      ) : (
        <text
          data-section-footer="1"
          x={48}
          y={tableTop + 44 + schedule.types.length * rowH + 28}
          textAnchor="start"
          fontSize={24}
          fontWeight={700}
          fontFamily={fontFamily}
          fill="#111827"
        >
          {`${text.totalLamellas}: ${schedule.totalLamellas} · ${text.totalSections}: ${schedule.totalSections}`}
        </text>
      )}
      {firstTables ? (
        <TrapezoidRowTables
          types={firstTables.types}
          startY={firstTables.startY}
          title={text.rowLengths}
          rtl={rtl}
          fontFamily={fontFamily}
        />
      ) : null}
    </svg>
  )

  const extraSheets = extraTables.map((sheet, index) => (
    <svg key={`rows-${index}`} viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} style={sheetStyle}>
      <text x={rtl ? SHEET_W - 88 : 48} y={48} textAnchor={anchor} direction={textDir} fontSize={32} fontWeight={700} fontFamily={fontFamily} fill="#111827">
        {text.title}
      </text>
      <TrapezoidRowTables
        types={sheet.types}
        startY={sheet.startY}
        title={text.rowLengths}
        rtl={rtl}
        fontFamily={fontFamily}
      />
    </svg>
  ))

  if (flowPages) {
    const printPage = { width: '281mm', height: '194mm', background: '#ffffff', display: 'block' }
    return (
      <>
        <section className="land" data-pdf-page="" data-pdf-orient="land" data-pdf-kind="html" dir="ltr" style={printPage}><div className="sections-slot">{page}</div></section>
        {extraSheets.map((sheet, index) => (
          <section key={index} className="land" data-pdf-page="" data-pdf-orient="land" data-pdf-kind="html" dir="ltr" style={printPage}><div className="sections-slot">{sheet}</div></section>
        ))}
      </>
    )
  }

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
      {page}
      {extraSheets}
    </div>
  )
}
