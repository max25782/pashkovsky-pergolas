'use client'

import { useState } from 'react'
import { calculatorConfig, type PergolaTypeId } from '@/config/siteCalculator'
import { whatsappUrl } from '@/config/siteContact'
import { calculate, formatPriceRange } from '@/lib/new-site/calc'
import { copy, t } from './i18n'
import { useNewSite } from './NewSiteProvider'
import { Tilt } from './Tilt'

const config = calculatorConfig

export function Calculator() {
  const { lang, openChat } = useNewSite()
  const [type, setType] = useState<PergolaTypeId>(config.types[0].id)
  const [width, setWidth] = useState(config.width.initial)
  const [depth, setDepth] = useState(config.depth.initial)

  const result = calculate({ type, width, depth }, config)
  const typeConfig = config.types.find((item) => item.id === type) ?? config.types[0]
  const w = width.toFixed(1)
  const d = depth.toFixed(1)

  return (
    <section id="calc" className="ns-section" aria-labelledby="ns-calc-title">
      <div className="ns-wrap">
        <span className="ns-kick">{t(copy.calc.kick, lang)}</span>
        <h2 id="ns-calc-title" className="ns-h2">
          {t(copy.calc.title, lang)}
        </h2>
        <p className="ns-sub">{t(copy.calc.sub, lang)}</p>

        <div className="ns-calc-grid">
          <Tilt className="ns-card2">
            <div className="ns-fld">
              <label htmlFor="ns-calc-type">{t(copy.calc.type, lang)}</label>
              <select id="ns-calc-type" value={type} onChange={(e) => setType(e.target.value as PergolaTypeId)}>
                {config.types.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t(item.label, lang)}
                  </option>
                ))}
              </select>
            </div>
            <div className="ns-fld">
              <label htmlFor="ns-calc-width">
                {t(copy.calc.width, lang)}
                <output htmlFor="ns-calc-width">{w} m</output>
              </label>
              <input
                id="ns-calc-width"
                type="range"
                min={config.width.min}
                max={config.width.max}
                step={config.width.step}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </div>
            <div className="ns-fld">
              <label htmlFor="ns-calc-depth">
                {t(copy.calc.depth, lang)}
                <output htmlFor="ns-calc-depth">{d} m</output>
              </label>
              <input
                id="ns-calc-depth"
                type="range"
                min={config.depth.min}
                max={config.depth.max}
                step={config.depth.step}
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              />
            </div>
          </Tilt>

          <Tilt className="ns-card2" delay={80}>
            <dl className="ns-res" aria-label={t(copy.calc.results, lang)}>
              <div>
                <dt>{t(copy.calc.area, lang)}</dt>
                <dd>{result.area.toFixed(1)} m&sup2;</dd>
              </div>
              <div>
                <dt>{t(copy.calc.posts, lang)}</dt>
                <dd>{result.posts}</dd>
              </div>
              {result.louvers !== null && (
                <div>
                  <dt>{t(copy.calc.louvers, lang)}</dt>
                  <dd>{result.louvers}</dd>
                </div>
              )}
              <div>
                <dt>{t(copy.calc.span, lang)}</dt>
                <dd>{result.maxSpan.toFixed(1)} m</dd>
              </div>
            </dl>
            <div className="ns-price">
              <b>{formatPriceRange(result, config)}</b>
              <small>{t(config.isSample ? copy.calc.sampleNote : copy.calc.finalNote, lang)}</small>
            </div>
            <div className="ns-calc-act">
              <a
                className="ns-btn ns-btn-a"
                href={whatsappUrl(t(copy.calc.waMessage(t(typeConfig.label, lang), w, d), lang))}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t(copy.calc.whatsapp, lang)}
              </a>
              <button type="button" className="ns-btn ns-btn-o" onClick={openChat}>
                {t(copy.calc.askAi, lang)}
              </button>
            </div>
          </Tilt>
        </div>
      </div>
    </section>
  )
}
