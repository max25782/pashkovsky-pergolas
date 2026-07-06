"use client"

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, Copy, Loader2, Box } from 'lucide-react'
import type {
  OfferDraft,
  Offer,
  PergolaShape,
  Pergola,
  PergolaProductType,
  QuickOfferFenceVariant,
  QuickOfferGlazingSystem,
  QuickOfferRailingsLocation,
} from '@/types/offer'
import { DEFAULT_OFFER_VALUES, PERGOLA_TYPE_NAMES, PERGOLA_TYPE_DEFAULT_PRICES } from '@/types/offer'
import { calculateOffer, quickOfferRailingsFenceAreaSqm } from '@/lib/offer-calculator'
import {
  hasAnyQuickOfferProduct,
  primaryQuickProduct,
  resolveQuickOfferIncludes,
} from '@/lib/quick-offer-includes'
import { usePriceFormatter } from '@/lib/use-price-formatter'
import { PergolaShapeSelector } from './PergolaShapeSelector'
import { calculatePergolaArea, validatePergolaShape } from '@/lib/calculations/pergola-area'
import { authFetch } from '@/lib/api/auth-fetch'
import type { Locale } from '@/lib/locales'
import { useLanguage } from '@/lib/language-context'
import { useToast } from '@/components/ui/toast'
import { OfferConfiguratorEmbed } from '@/components/offers/OfferConfiguratorEmbed'

interface CreateOfferModalProps {
  dealId: string
  customerName: string
  customerPhone?: string
  customerCity?: string
  isOpen: boolean
  onClose: () => void
  onCreated?: (offer: Offer) => void
}

type PostCreateStep = 'form' | 'configurator'

export function CreateOfferModal({ dealId, customerName, customerPhone, customerCity, isOpen, onClose, onCreated }: CreateOfferModalProps) {
  const params = useParams()
  const locale = (params?.locale as Locale) || 'he'
  const { language: crmLanguage } = useLanguage()
  const fmt = usePriceFormatter()
  const toast = useToast()
  const tDeals = useTranslations('deals')
  const tQuick = useTranslations('quickOffer')

  const [postCreateStep, setPostCreateStep] = useState<PostCreateStep>('form')
  const [createdOffer, setCreatedOffer] = useState<Offer | null>(null)
  const [configuratorUrls, setConfiguratorUrls] = useState<{ edit: string; customer: string } | null>(
    null,
  )
  const [configuratorLinkLoading, setConfiguratorLinkLoading] = useState(false)
  const [configuratorLinkError, setConfiguratorLinkError] = useState<string | null>(null)

  function buildInitialDraft(): OfferDraft {
    return {
      dealId,
      customerName,
      customerPhone,
      customerCity,
      includePergola: true,
      includeRailings: false,
      includeFence: false,
      quickProduct: DEFAULT_OFFER_VALUES.quickProduct,
      quickRailings: { ...DEFAULT_OFFER_VALUES.quickRailings },
      quickFence: { ...DEFAULT_OFFER_VALUES.quickFence },
      pergolas: [{ ...DEFAULT_OFFER_VALUES.pergola }],
      color: { ...DEFAULT_OFFER_VALUES.color },
      roof: { ...DEFAULT_OFFER_VALUES.roof },
      shadingRatio: DEFAULT_OFFER_VALUES.shadingRatio,
      finishType: DEFAULT_OFFER_VALUES.finishType,
      finishValue: DEFAULT_OFFER_VALUES.finishValue,
      santaf: { ...DEFAULT_OFFER_VALUES.santaf },
      zipScreen: { ...DEFAULT_OFFER_VALUES.zipScreen },
      lighting: { ...DEFAULT_OFFER_VALUES.lighting },
      drainage: { ...DEFAULT_OFFER_VALUES.drainage },
      winterClosure: { ...DEFAULT_OFFER_VALUES.winterClosure },
      options: { ...DEFAULT_OFFER_VALUES.options },
      vatPercent: DEFAULT_OFFER_VALUES.vatPercent,
      discountPercent: 0,
      images: [],
    }
  }

  const [draft, setDraft] = useState<OfferDraft>(buildInitialDraft)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isImprovingText, setIsImprovingText] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)

  const calculation = useMemo(() => calculateOffer(draft), [draft])
  const includes = useMemo(() => resolveQuickOfferIncludes(draft), [draft])

  function setProductInclude(key: 'pergola' | 'railings' | 'fence', enabled: boolean) {
    setDraft((d) => {
      const cur = resolveQuickOfferIncludes(d)
      const next = { ...cur, [key]: enabled }
      if (!hasAnyQuickOfferProduct(next)) return d
      return {
        ...d,
        includePergola: next.pergola,
        includeRailings: next.railings,
        includeFence: next.fence,
        quickProduct: primaryQuickProduct(next),
      }
    })
  }

  function patchQuickRailings(patch: Partial<NonNullable<OfferDraft['quickRailings']>>) {
    setDraft((d) => ({
      ...d,
      quickRailings: { ...(d.quickRailings ?? { ...DEFAULT_OFFER_VALUES.quickRailings }), ...patch },
    }))
  }

  function patchQuickFence(patch: Partial<NonNullable<OfferDraft['quickFence']>>) {
    setDraft((d) => ({
      ...d,
      quickFence: { ...(d.quickFence ?? { ...DEFAULT_OFFER_VALUES.quickFence }), ...patch },
    }))
  }

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    setError(null)

    const inc = resolveQuickOfferIncludes(draft)
    if (!hasAnyQuickOfferProduct(inc)) {
      setError(tQuick('errorNoProduct'))
      setIsSubmitting(false)
      return
    }
    if (inc.railings && draft.quickRailings) {
      if (!draft.quickRailings.metersTotal || draft.quickRailings.metersTotal <= 0) {
        setError(tQuick('errorRailingsMeters'))
        setIsSubmitting(false)
        return
      }
      if (draft.quickRailings.heightCm == null || draft.quickRailings.heightCm <= 0) {
        setError(tQuick('errorRailingsHeight'))
        setIsSubmitting(false)
        return
      }
      if (!draft.quickRailings.profileType?.trim() || !draft.quickRailings.color?.trim()) {
        setError(tQuick('errorRailingsFields'))
        setIsSubmitting(false)
        return
      }
    }
    if (inc.fence && draft.quickFence) {
      if (!draft.quickFence.metersTotal || draft.quickFence.metersTotal <= 0) {
        setError(tQuick('errorFenceMeters'))
        setIsSubmitting(false)
        return
      }
      if (draft.quickFence.heightCm == null || draft.quickFence.heightCm <= 0) {
        setError(tQuick('errorFenceHeight'))
        setIsSubmitting(false)
        return
      }
      if (!draft.quickFence.color?.trim()) {
        setError(tQuick('errorFenceColor'))
        setIsSubmitting(false)
        return
      }
    }

    try {
      const requestBody = {
        ...draft,
        ...calculation,
        pergolas: inc.pergola ? draft.pergolas : [],
        includePergola: inc.pergola,
        includeRailings: inc.railings,
        includeFence: inc.fence,
        quickProduct: primaryQuickProduct(inc),
      }
      
      const response = await authFetch('/api/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to create offer'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
          if (errorData.details) {
            console.error('Error details:', errorData.details)
          }
          if (errorData.code) {
            console.error('Error code:', errorData.code)
          }
        } catch (e) {
          const text = await response.text()
          errorMessage = `Server error (${response.status}): ${text.substring(0, 200)}`
          console.error('Response text:', text)
        }
        throw new Error(errorMessage)
      }

      const newOffer = (await response.json()) as Offer
      onCreated?.(newOffer)
      if (inc.pergola) {
        setCreatedOffer(newOffer)
        setConfiguratorUrls(null)
        setConfiguratorLinkError(null)
        setPostCreateStep('configurator')
      } else {
        toast.success('הצעת המחיר נוצרה בהצלחה')
        setPostCreateStep('form')
        setCreatedOffer(null)
        onClose()
      }
    } catch (err: unknown) {
      console.error('Error creating offer:', err)
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to create offer. Please check console for details.')
    } finally {
      setIsSubmitting(false)
    }
  }, [draft, calculation, onCreated, onClose, tQuick, toast])

  useEffect(() => {
    if (!isOpen) {
      setPostCreateStep('form')
      setCreatedOffer(null)
      setConfiguratorUrls(null)
      setConfiguratorLinkError(null)
      setConfiguratorLinkLoading(false)
    } else {
      setDraft(buildInitialDraft())
      setError(null)
      setAiSuggestion(null)
      setPostCreateStep('form')
    }
  }, [isOpen, dealId, customerName, customerPhone, customerCity])

  useEffect(() => {
    if (postCreateStep !== 'configurator' || createdOffer === null || configuratorUrls !== null) return
    let cancelled = false
    setConfiguratorLinkLoading(true)
    setConfiguratorLinkError(null)
    void (async () => {
      try {
        const res = await authFetch(`/api/offers/${createdOffer.id}/configurator-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? `HTTP ${res.status}`)
        }
        const data = (await res.json()) as { url?: string; customerUrl?: string }
        if (cancelled) return
        if (!data.url) throw new Error('No URL')
        const customer =
          data.customerUrl ??
          `${data.url}${data.url.includes('?') ? '&' : '?'}view=1`
        setConfiguratorUrls({ edit: data.url, customer })
      } catch (e) {
        if (!cancelled) {
          setConfiguratorLinkError(e instanceof Error ? e.message : 'שגיאה ביצירת קישור')
        }
      } finally {
        if (!cancelled) setConfiguratorLinkLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [postCreateStep, createdOffer, configuratorUrls, locale])

  const handleFinishConfigurator = useCallback(() => {
    setPostCreateStep('form')
    setCreatedOffer(null)
    setConfiguratorUrls(null)
    setConfiguratorLinkError(null)
    onClose()
  }, [onClose])

  const handleCopyCustomerConfiguratorLink = useCallback(async () => {
    if (!configuratorUrls?.customer) return
    try {
      await navigator.clipboard.writeText(configuratorUrls.customer)
      toast.success('קישור תצוגת 3D ללקוח הועתק')
    } catch {
      toast.error('העתקה ללוח נכשלה')
    }
  }, [configuratorUrls?.customer, toast])

  const retryConfiguratorLink = useCallback(() => {
    setConfiguratorUrls(null)
    setConfiguratorLinkError(null)
  }, [])

  // Helper to get current pergolas array (support both new and legacy format)
  const getPergolas = useCallback(() => {
    return draft.pergolas || (draft.pergola ? [draft.pergola] : [])
  }, [draft])

  // Add a new pergola
  const addPergola = useCallback(() => {
    setDraft(prev => {
      const currentPergolas = prev.pergolas || (prev.pergola ? [prev.pergola] : [])
      return {
        ...prev,
        pergolas: [...currentPergolas, { ...DEFAULT_OFFER_VALUES.pergola }],
        pergola: undefined // Clear legacy field
      }
    })
  }, [])

  // Remove a pergola by index
  const removePergola = useCallback((index: number) => {
    setDraft(prev => {
      const currentPergolas = prev.pergolas || (prev.pergola ? [prev.pergola] : [])
      const newPergolas = currentPergolas.filter((_, i) => i !== index)
      return {
        ...prev,
        pergolas: newPergolas.length > 0 ? newPergolas : undefined,
        pergola: undefined // Clear legacy field
      }
    })
  }, [])

  // Update a specific pergola by index
  const updatePergola = useCallback((index: number, updates: Partial<Pergola>) => {
    setDraft(prev => {
      const currentPergolas = prev.pergolas || (prev.pergola ? [prev.pergola] : [])
      const newPergolas = [...currentPergolas]
      newPergolas[index] = { ...newPergolas[index], ...updates }
      return {
        ...prev,
        pergolas: newPergolas,
        pergola: undefined // Clear legacy field
      }
    })
  }, [])

  // Update pergola shape by index
  const updatePergolaShape = useCallback((index: number, shape: PergolaShape) => {
    setDraft(prev => {
      const currentPergolas = prev.pergolas || (prev.pergola ? [prev.pergola] : [])
      const newPergolas = [...currentPergolas]
      newPergolas[index] = { ...newPergolas[index], shape }
      return {
        ...prev,
        pergolas: newPergolas,
        pergola: undefined // Clear legacy field
      }
    })
  }, [])

  const updateColor = useCallback((updates: Partial<typeof draft.color>) => {
    setDraft(prev => ({ ...prev, color: { ...prev.color, ...updates } }))
  }, [])

  const updateRoof = useCallback((updates: Partial<typeof draft.roof>) => {
    setDraft(prev => ({ ...prev, roof: { ...prev.roof, ...updates } }))
  }, [])

  const updateSantaf = useCallback((updates: Partial<typeof draft.santaf>) => {
    setDraft(prev => ({ ...prev, santaf: { ...prev.santaf, ...updates } }))
  }, [])

  const updateZipScreen = useCallback((updates: Partial<typeof draft.zipScreen>) => {
    setDraft(prev => ({ ...prev, zipScreen: { ...prev.zipScreen, ...updates } }))
  }, [])

  const updateLighting = useCallback((updates: Partial<typeof draft.lighting>) => {
    setDraft(prev => ({ ...prev, lighting: { ...prev.lighting, ...updates } }))
  }, [])

  const updateDrainage = useCallback((updates: Partial<typeof draft.drainage>) => {
    setDraft(prev => ({ ...prev, drainage: { ...prev.drainage, ...updates } }))
  }, [])

  const updateWinterClosure = useCallback((updates: Partial<typeof draft.winterClosure>) => {
    setDraft(prev => ({ ...prev, winterClosure: { ...prev.winterClosure, ...updates } }))
  }, [])

  const updateOptions = useCallback((updates: Partial<typeof draft.options>) => {
    setDraft(prev => ({ ...prev, options: { ...prev.options, ...updates } }))
  }, [])
  
  // Build a comprehensive spec sheet from the full offer draft for the AI
  const buildOfferSpecText = useCallback((): string => {
    const inc = resolveQuickOfferIncludes(draft)
    const lines: string[] = []

    if (customerName) lines.push(`לקוח: ${customerName}`)
    if (customerCity) lines.push(`עיר: ${customerCity}`)
    lines.push('')

    // Pergola section
    if (inc.pergola && draft.pergolas && draft.pergolas.length > 0) {
      draft.pergolas.forEach((p, i) => {
        const typeName = p.pergolaType ? PERGOLA_TYPE_NAMES[p.pergolaType] : 'פרגולת אלומיניום'
        const prefix = draft.pergolas!.length > 1 ? `פרגולה ${i + 1}: ` : ''
        lines.push(`${prefix}${typeName}`)

        if (p.shape.type === 'rectangle') {
          lines.push(`מידות: ${p.shape.width} × ${p.shape.length} מ' (${calculatePergolaArea(p.shape).toFixed(1)} מ"ר)`)
        } else {
          lines.push(`צורה: ${p.shape.type === 'L' ? 'L' : p.shape.type === 'U' ? 'U' : 'X'} | שטח: ${calculatePergolaArea(p.shape).toFixed(1)} מ"ר`)
        }

        if (p.height) lines.push(`גובה: ${p.height} ס"מ`)
        if (p.location) lines.push(`מיקום: ${p.location}`)
      })
    }

    if (inc.railings && draft.quickRailings) {
      const sqm = quickOfferRailingsFenceAreaSqm(draft.quickRailings.metersTotal, draft.quickRailings.heightCm)
      lines.push(`מעקות: ${sqm.toFixed(1)} מ"ר (${draft.quickRailings.metersTotal}מ' רצים, גובה ${draft.quickRailings.heightCm} ס"מ)`)
      if (draft.quickRailings.profileType) lines.push(`פרופיל מעקה: ${draft.quickRailings.profileType}`)
      if (draft.quickRailings.color) lines.push(`צבע מעקה: ${draft.quickRailings.color}`)
    }

    if (inc.fence && draft.quickFence) {
      const sqm = quickOfferRailingsFenceAreaSqm(draft.quickFence.metersTotal, draft.quickFence.heightCm)
      lines.push(`גדר: ${sqm.toFixed(1)} מ"ר (${draft.quickFence.metersTotal}מ' רצים, גובה ${draft.quickFence.heightCm} ס"מ)`)
      if (draft.quickFence.color) lines.push(`צבע גדר: ${draft.quickFence.color}`)
    }

    // Color & finish
    if (inc.pergola) {
      const colorMap: Record<string, string> = { white: 'לבן', black: 'שחור', cream: 'קרם', ral: 'RAL מיוחד', wood: 'עץ' }
      const colorLabel = colorMap[draft.color.type] ?? draft.color.type
      const colorDetail = draft.color.type === 'ral' && draft.color.ralCode
        ? `${colorLabel} ${draft.color.ralCode}`
        : draft.color.type === 'wood' && draft.color.woodName
          ? `${colorLabel} – ${draft.color.woodName}`
          : colorLabel
      lines.push(`צבע: ${colorDetail}`)

      if (draft.roof.type === 'santaf') lines.push(`גג: סנטף BH${draft.roof.santafColor ? ` (${draft.roof.santafColor})` : ''}`)
      else if (draft.roof.type === 'triplexGlass') lines.push('גג: זכוכית טריפלקס')
    }

    // Add-ons
    const addons: string[] = []
    if (inc.pergola && draft.santaf.enabled) {
      addons.push(`סנטף BH ${draft.santaf.withStructure ? 'עם קונסטרוקציה' : 'בסיסי'} — ${fmt(calculation.santafTotal ?? 0)}`)
    }
    if (draft.zipScreen.enabled) {
      addons.push(`מסך ZIP ${draft.zipScreen.type === 'electric' ? 'חשמלי' : 'ידני'}${draft.zipScreen.runningMeters ? ` (${draft.zipScreen.runningMeters}מ')` : ''} — ${fmt(calculation.zipScreenTotal ?? 0)}`)
    }
    if (draft.lighting.enabled) {
      addons.push(`תאורת לד${draft.lighting.runningMeters ? ` (${draft.lighting.runningMeters}מ')` : ''} — ${fmt(calculation.lightingTotal ?? 0)}`)
    }
    if (draft.drainage.enabled) {
      addons.push(`מערכת ניקוז${draft.drainage.runningMeters ? ` (${draft.drainage.runningMeters}מ')` : ''} — ${fmt(calculation.drainageTotal ?? 0)}`)
    }
    if (draft.winterClosure.enabled && draft.winterClosure.items && draft.winterClosure.items.length > 0) {
      const winterTypeMap: Record<string, string> = {
        foldingGlass: 'זכוכית מתקפלת', windows7000: 'חלונות 7000', windows9000: 'חלונות 9000',
        fixedGlass: 'זכוכית קבועה', slidingShowcase7000: 'ויטרינה הזזה 7000',
        slidingShowcase9000: 'ויטרינה הזזה 9000', sliderGlass: 'זכוכית הזזה',
      }
      const winterItems = draft.winterClosure.items.map(item => `${winterTypeMap[item.type] ?? item.type} ${item.area}מ"ר`).join(', ')
      addons.push(`סגירת חורף: ${winterItems} — ${fmt(calculation.winterClosureTotal ?? 0)}`)
    }
    if (addons.length > 0) {
      lines.push('')
      lines.push('תוספות:')
      addons.forEach(a => lines.push(`- ${a}`))
    }

    // Pricing
    lines.push('')
    if (draft.discountPercent > 0) {
      lines.push(`הנחה: ${draft.discountPercent}%`)
    }
    lines.push(`מחיר לפני מע"מ: ${fmt(calculation.totalBeforeVat)}`)
    lines.push(`מע"מ (${draft.vatPercent}%): ${fmt(calculation.vatAmount)}`)
    lines.push(`מחיר סופי כולל מע"מ: ${fmt(calculation.finalPrice)}`)

    // Existing notes (if any) — append as extra context
    const existingNotes = draft.options.notes?.trim()
    if (existingNotes) {
      lines.push('')
      lines.push('הערות נוספות:')
      lines.push(existingNotes)
    }

    return lines.join('\n')
  }, [draft, calculation, customerName, customerCity, fmt])

  const improveNotesWithAI = useCallback(async () => {
    setIsImprovingText(true)
    setError(null)
    setAiSuggestion(null)

    try {
      const specText = buildOfferSpecText()

      const response = await authFetch('/api/ai/improve-offer-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: specText,
          outputLanguage: crmLanguage,
          context: {
            customerName: customerName,
            pergolaType: draft.pergolas?.[0]?.pergolaType
              ? PERGOLA_TYPE_NAMES[draft.pergolas[0].pergolaType]
              : 'פרגולת אלומיניום',
            price: calculation.finalPrice,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[AI Improve] Error response:', errorData)
        throw new Error(errorData.error || 'Failed to improve text')
      }

      const data = await response.json()
      setAiSuggestion(data.improvedText)
    } catch (err: unknown) {
      console.error('[AI Improve] Error:', err)
      setError((err instanceof Error ? err.message : String(err)) || 'שגיאה בשיפור הטקסט')
    } finally {
      setIsImprovingText(false)
    }
  }, [buildOfferSpecText, customerName, draft.pergolas, calculation.finalPrice, crmLanguage])

  // Generate complete professional description automatically
  const generateCompleteDescription = useCallback(async () => {
    setIsGeneratingDescription(true)
    setError(null)

    try {
      const specText = buildOfferSpecText()

      const response = await authFetch('/api/ai/improve-offer-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: specText,
          outputLanguage: crmLanguage,
          context: {
            customerName: customerName,
            pergolaType: draft.pergolas?.[0]?.pergolaType
              ? PERGOLA_TYPE_NAMES[draft.pergolas[0].pergolaType]
              : 'פרגולת אלומיניום',
            price: calculation.finalPrice,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[AI Generate] Error response:', errorData)
        throw new Error(errorData.error || 'Failed to generate description')
      }

      const data = await response.json()
      updateOptions({ notes: data.improvedText })
      setAiSuggestion(null)
    } catch (err: unknown) {
      console.error('[AI Generate] Error:', err)
      setError((err instanceof Error ? err.message : String(err)) || 'שגיאה ביצירת תיאור אוטומטי')
    } finally {
      setIsGeneratingDescription(false)
    }
  }, [buildOfferSpecText, customerName, draft.pergolas, calculation.finalPrice, crmLanguage, updateOptions])

  const acceptAiSuggestion = useCallback(() => {
    if (aiSuggestion) {
      updateOptions({ notes: aiSuggestion })
      setAiSuggestion(null)
    }
  }, [aiSuggestion, updateOptions])

  const saveDisabled = useMemo(() => {
    if (!hasAnyQuickOfferProduct(includes)) return true
    if (!includes.pergola) return false
    const pergolas = draft.pergolas || (draft.pergola ? [draft.pergola] : [])
    return pergolas.some(
      (p) => !validatePergolaShape(p.shape).valid || calculatePergolaArea(p.shape) <= 0,
    )
  }, [includes, draft.pergolas, draft.pergola])

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) {
          if (postCreateStep === 'configurator') handleFinishConfigurator()
          else onClose()
        }
      }}
    >
      <DialogContent 
        className="!translate-x-0 !translate-y-0 max-md:!inset-0 max-md:!left-0 max-md:!top-0 max-md:!h-screen max-md:!w-screen max-md:!max-h-screen md:!left-[max(0px,calc((100vw-min(1600px,98vw))/2))] md:!top-[2.5vh] md:!right-auto md:!h-[95vh] md:!max-h-[95vh] md:!w-[min(1600px,98vw)] md:!max-w-[1600px] w-screen max-w-screen h-screen max-h-screen bg-[#1e293b] text-white border border-white/20 p-0 flex flex-col rounded-none md:rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-row items-start justify-between gap-3" onClick={(e) => e.stopPropagation()}>
          <DialogTitle className="text-2xl font-bold">
            {postCreateStep === 'form' ? 'יצירת הצעת מחיר חדשה' : 'קונפיגורטור 3D — הצעה חדשה'}
          </DialogTitle>
          <DialogDescription className="sr-only">Create new offer for client</DialogDescription>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (postCreateStep === 'configurator') handleFinishConfigurator()
              else onClose()
            }}
            data-dialog-close
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition"
            aria-label="סגור"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        <div
          className={
            'flex min-h-0 flex-1 flex-col space-y-6 p-6 ' +
            (postCreateStep === 'form' ? 'overflow-y-auto' : 'overflow-hidden')
          }
          onClick={(e) => e.stopPropagation()}
        >
          {postCreateStep === 'form' ? (
          <>
          {/* Client Info */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <h3 className="text-lg font-semibold mb-3">פרטי לקוח</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-white/60">שם:</span> <span className="mr-2 font-medium">{customerName}</span></div>
              {customerPhone && <div><span className="text-white/60">טלפון:</span> <span className="mr-2 font-medium">{customerPhone}</span></div>}
              {customerCity && <div className="col-span-2"><span className="text-white/60">עיר:</span> <span className="mr-2 font-medium">{customerCity}</span></div>}
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <h3 className="text-lg font-semibold mb-2">{tQuick('sectionProductType')}</h3>
            <p className="text-sm text-white/70 mb-3">{tQuick('fieldProductKind')}</p>
            <div className="flex flex-wrap gap-4 mb-2">
              {(
                [
                  ['pergola', 'workTypes.pergola', includes.pergola],
                  ['railings', 'workTypes.railings', includes.railings],
                  ['fence', 'workTypes.fence', includes.fence],
                ] as const
              ).map(([key, labelKey, checked]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setProductInclude(key, e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span>{tDeals(labelKey)}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-white/50">{tQuick('productComboHint')}</p>
          </div>

          {includes.pergola && (
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">פרגולות</h3>
              <button
                type="button"
                onClick={addPergola}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded border border-blue-500 transition text-sm"
              >
                + הוסף פרגולה
              </button>
            </div>

            {/* List of Pergolas */}
            {getPergolas().length === 0 ? (
              <div className="text-center py-8 text-white/60">
                <p>אין פרגולות בהצעה. לחץ על "הוסף פרגולה" כדי להתחיל.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {getPergolas().map((pergola, index) => {
                  const pergolaArea = pergola?.shape ? calculatePergolaArea(pergola.shape) : 0
                  const pergolaPrice = pergolaArea * pergola.pricePerSqm
                  
                  return (
                    <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10 relative">
                      {/* Remove button */}
                      {getPergolas().length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePergola(index)}
                          className="absolute top-2 left-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                          title="הסר פרגולה"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      
                      <div className="mb-2">
                        <h4 className="text-md font-semibold text-white/90">
                          פרגולה #{index + 1}
                        </h4>
                      </div>

                      {/* Pergola Type */}
                      <div className="mb-4">
                        <label className="block text-sm text-white/80 mb-1">סוג פרגולה</label>
                        <select
                          value={pergola.pergolaType ?? 'fixed'}
                          onChange={(e) => {
                            const t = e.target.value as PergolaProductType
                            updatePergola(index, {
                              pergolaType: t,
                              pricePerSqm: PERGOLA_TYPE_DEFAULT_PRICES[t],
                            })
                          }}
                          className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                        >
                          {(Object.keys(PERGOLA_TYPE_NAMES) as PergolaProductType[]).map((key) => (
                            <option key={key} value={key} className="bg-gray-800">
                              {tDeals(key === 'fixed' ? 'pergolaFixed' : key === 'electricPvc' ? 'pergolaElectricPvc' : 'pergolaElectricBioclimatic')} ({PERGOLA_TYPE_DEFAULT_PRICES[key].toLocaleString()} ₪/מ״ר)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Shape Selector */}
                      <div className="mb-4">
                        <PergolaShapeSelector
                          value={pergola.shape}
                          onChange={(shape) => updatePergolaShape(index, shape)}
                        />
                      </div>

                      {/* Height, Location, Price */}
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <label className="block text-sm text-white/80 mb-1">גובה (אופציונלי)</label>
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0" 
                            value={pergola.height || ''} 
                            onChange={(e) => updatePergola(index, { height: e.target.value ? parseFloat(e.target.value) : undefined })} 
                            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" 
                            placeholder="לא חובה" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-white/80 mb-1">מקום בבית</label>
                          <input 
                            type="text" 
                            value={pergola.location || ''} 
                            onChange={(e) => updatePergola(index, { location: e.target.value || undefined })} 
                            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" 
                            placeholder="גינה..." 
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-white/80 mb-1">מחיר למ״ר (₪)</label>
                          <input 
                            type="number" 
                            step="10" 
                            min="0" 
                            value={pergola.pricePerSqm} 
                            onChange={(e) => updatePergola(index, { pricePerSqm: parseFloat(e.target.value) || 750 })} 
                            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" 
                          />
                        </div>
                        <div className="flex items-end">
                          <div className="text-sm w-full">
                            <div className="text-white/60">שטח: <span className="font-bold text-blue-400">{pergolaArea.toFixed(2)} מ״ר</span></div>
                            <div className="text-white/60">מחיר: <span className="font-bold text-green-400">{fmt(pergolaPrice)}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                
                {/* Total Summary */}
                <div className="bg-blue-600/20 rounded-lg p-4 border border-blue-500/30 mt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-white/80">שטח כולל:</span>
                      <span className="mr-2 font-bold text-blue-300">{calculation.area.toFixed(2)} מ״ר</span>
                    </div>
                    <div>
                      <span className="text-white/80">סה״כ פרגולות:</span>
                      <span className="mr-2 font-bold text-green-300">{fmt(calculation.pergolaTotal ?? 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 flex-1 text-xs text-white/55">
                    שומר את ההצעה ופותח קונפיגורטור 3D מקושר (מידות מההצעה יסתנכרנו אחרי שמירה ב־3D).
                  </p>
                  <Button
                    type="button"
                    className="shrink-0 self-stretch bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center gap-2 sm:self-auto"
                    disabled={isSubmitting || saveDisabled}
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleSubmit()
                    }}
                  >
                    <Box className="w-4 h-4" />
                    {isSubmitting ? 'שומר...' : '3D — שמור ופתח קונפיגורטור'}
                  </Button>
                </div>
              </div>
            )}
          </div>
          )}

          {includes.railings && draft.quickRailings && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 space-y-3">
              <h3 className="text-lg font-semibold">{tDeals('railingsDetails')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-white/80 mb-1">{tDeals('metersTotal')}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={draft.quickRailings.metersTotal || ''}
                    onChange={(e) => patchQuickRailings({ metersTotal: Number(e.target.value) || 0 })}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/80 mb-1">{tDeals('heightCm')}</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.quickRailings.heightCm ?? ''}
                    onChange={(e) =>
                      patchQuickRailings({
                        heightCm: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              <p className="text-xs text-white/50">
                {tQuick('computedAreaSqm', {
                  area: quickOfferRailingsFenceAreaSqm(
                    draft.quickRailings.metersTotal,
                    draft.quickRailings.heightCm,
                  ).toFixed(2),
                })}
              </p>
              <div>
                <label className="block text-sm text-white/80 mb-1">{tDeals('profileType')}</label>
                <input
                  value={draft.quickRailings.profileType}
                  onChange={(e) => patchQuickRailings({ profileType: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-1">{tDeals('color')}</label>
                <input
                  value={draft.quickRailings.color}
                  onChange={(e) => patchQuickRailings({ color: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-1">{tDeals('locationType')}</label>
                <select
                  value={draft.quickRailings.locationType}
                  onChange={(e) =>
                    patchQuickRailings({
                      locationType: e.target.value as QuickOfferRailingsLocation,
                    })
                  }
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                >
                  <option value="balcony">{tDeals('locationTypes.balcony')}</option>
                  <option value="stairs">{tDeals('locationTypes.stairs')}</option>
                  <option value="roof">{tDeals('locationTypes.roof')}</option>
                  <option value="yard">{tDeals('locationTypes.yard')}</option>
                  <option value="other">{tDeals('locationTypes.other')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-2">{tDeals('glazingSystem')}</label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['aluminum_glass', 'glazingAluminumGlass'],
                      ['wet_glazing', 'glazingWet'],
                      ['dry_glazing', 'glazingDry'],
                    ] as const
                  ).map(([v, msgKey]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => patchQuickRailings({ glazingSystem: v as QuickOfferGlazingSystem })}
                      className={`px-3 py-1 rounded text-sm border ${
                        draft.quickRailings!.glazingSystem === v
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-white/10 border-white/20 text-white/80'
                      }`}
                    >
                      {tDeals(msgKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-1">₪/מ״ר</label>
                <input
                  type="number"
                  min={0}
                  value={draft.quickRailings.pricePerSqm}
                  onChange={(e) => patchQuickRailings({ pricePerSqm: Number(e.target.value) || 0 })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                />
              </div>
              {calculation.railingsLineTotal != null && calculation.railingsLineTotal > 0 && (
                <div className="text-sm text-green-400">
                  {tDeals('workTypes.railings')}: {fmt(calculation.railingsLineTotal)}
                </div>
              )}
            </div>
          )}

          {includes.fence && draft.quickFence && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 space-y-3">
              <h3 className="text-lg font-semibold">{tDeals('fenceDetails')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-white/80 mb-1">{tDeals('metersTotal')}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={draft.quickFence.metersTotal || ''}
                    onChange={(e) => patchQuickFence({ metersTotal: Number(e.target.value) || 0 })}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/80 mb-1">{tDeals('heightCm')}</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.quickFence.heightCm ?? ''}
                    onChange={(e) =>
                      patchQuickFence({
                        heightCm: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              <p className="text-xs text-white/50">
                {tQuick('computedAreaSqm', {
                  area: quickOfferRailingsFenceAreaSqm(
                    draft.quickFence.metersTotal,
                    draft.quickFence.heightCm,
                  ).toFixed(2),
                })}
              </p>
              <div>
                <label className="block text-sm text-white/80 mb-2">{tDeals('fenceVariant')}</label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['classic', 'fenceClassic'],
                      ['hitech', 'fenceHitech'],
                      ['hitech_angular', 'fenceHitechAngular'],
                    ] as const
                  ).map(([v, msgKey]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => patchQuickFence({ fenceVariant: v as QuickOfferFenceVariant })}
                      className={`px-3 py-1 rounded text-sm border ${
                        draft.quickFence!.fenceVariant === v
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-white/10 border-white/20 text-white/80'
                      }`}
                    >
                      {tDeals(msgKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-1">{tDeals('color')}</label>
                <input
                  value={draft.quickFence.color}
                  onChange={(e) => patchQuickFence({ color: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-1">₪/מ״ר</label>
                <input
                  type="number"
                  min={0}
                  value={draft.quickFence.pricePerSqm}
                  onChange={(e) => patchQuickFence({ pricePerSqm: Number(e.target.value) || 0 })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                />
              </div>
              {calculation.fenceLineTotal != null && calculation.fenceLineTotal > 0 && (
                <div className="text-sm text-green-400">
                  {tDeals('workTypes.fence')}: {fmt(calculation.fenceLineTotal)}
                </div>
              )}
            </div>
          )}

          {/* Shading Ratio and Finish (shared for all pergolas) */}
          {includes.pergola && getPergolas().length > 0 && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h3 className="text-lg font-semibold mb-3">הגדרות כלליות לפרגולות</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-white/70">הצללה</label>
                  <select
                    value={draft.shadingRatio || ''}
                    onChange={(e) => {
                      const value = (e.target.value as '40/20' | '50/20' | '70/20' | '') || null
                      setDraft(prev => ({ ...prev, shadingRatio: value }))
                    }}
                    className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
                  >
                    <option value="">בחר</option>
                    <option value="40/20">40/20</option>
                    <option value="50/20">50/20</option>
                    <option value="70/20">70/20</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-sm text-white/70">גמר (RAL / דמוי עץ)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={draft.finishType || ''}
                      onChange={(e) => {
                        const value = (e.target.value as 'ral' | 'wood' | '') || null
                        setDraft(prev => ({ ...prev, finishType: value }))
                      }}
                      className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
                    >
                    <option value="">בחר</option>
                    <option value="ral">RAL</option>
                    <option value="wood">דמוי עץ</option>
                  </select>
                  <input
                    value={draft.finishValue || ''}
                    onChange={(e) => setDraft(prev => ({ ...prev, finishValue: e.target.value || '' }))}
                    className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
                    placeholder="קוד RAL או שם עץ"
                  />
                </div>
              </div>
            </div>
          </div>
          )}

          {includes.pergola && (
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <h3 className="text-lg font-semibold mb-3">צבע אלומיניום</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {(['white', 'black', 'cream', 'ral', 'wood'] as const).map((colorType) => (
                  <label key={colorType} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="colorType" value={colorType} checked={draft.color.type === colorType} onChange={() => updateColor({ type: colorType, ralCode: undefined, woodName: undefined })} className="w-4 h-4" />
                    <span className="text-sm">{colorType === 'white' && 'לבן'}{colorType === 'black' && 'שחור'}{colorType === 'cream' && 'קרם'}{colorType === 'ral' && 'RAL'}{colorType === 'wood' && 'דמוי עץ'}</span>
                  </label>
                ))}
              </div>
              {draft.color.type === 'ral' && <input type="text" placeholder="קוד RAL" value={draft.color.ralCode || ''} onChange={(e) => updateColor({ ralCode: e.target.value || undefined })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" />}
              {draft.color.type === 'wood' && <input type="text" placeholder="סוג דמוי עץ" value={draft.color.woodName || ''} onChange={(e) => updateColor({ woodName: e.target.value || undefined })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" />}
            </div>
          </div>
          )}

          {includes.pergola && (
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <h3 className="text-lg font-semibold mb-3">סוג גג</h3>
            <div className="space-y-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="roofType" value="santaf" checked={draft.roof.type === 'santaf'} onChange={() => updateRoof({ type: 'santaf', santafColor: 'transparent' })} className="w-4 h-4" /><span>סנטף BH</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="roofType" value="triplexGlass" checked={draft.roof.type === 'triplexGlass'} onChange={() => updateRoof({ type: 'triplexGlass', santafColor: undefined })} className="w-4 h-4" /><span>זכוכית טריפלקס</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="roofType" value="" checked={draft.roof.type === null} onChange={() => updateRoof({ type: null, santafColor: undefined })} className="w-4 h-4" /><span>ללא גג</span></label>
              </div>
              {draft.roof.type === 'santaf' && (
                <div className="grid grid-cols-4 gap-2">
                  {(['transparent', 'gray', 'white', 'gold'] as const).map((color) => (
                    <label key={color} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="santafColor" value={color} checked={draft.roof.santafColor === color} onChange={() => updateRoof({ santafColor: color })} className="w-4 h-4" />
                      <span className="text-sm">{color === 'transparent' && 'שקוף'}{color === 'gray' && 'אפור'}{color === 'white' && 'לבן'}{color === 'gold' && 'זהב'}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {includes.pergola && (
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">סנטף (מסכים)</h3>
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <span className="text-sm text-white/80">הוסף סנטף</span>
                <input type="checkbox" checked={draft.santaf.enabled} onChange={(e) => { e.stopPropagation(); updateSantaf({ enabled: e.target.checked }) }} className="w-5 h-5 rounded" />
              </label>
            </div>
            {draft.santaf.enabled && (
              <div className="space-y-4">
                {/* Dimensions - only show if pergola is not included */}
                {!includes.pergola && (
                  <div>
                    <label className="block text-sm text-white/80 mb-2">מידות (מ״ר)</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-white/60 mb-1">רוחב (מ׳)</label>
                        <select
                          value={draft.santaf.width?.toString() ?? ''} 
                          onChange={(e) => {
                            const width = e.target.value ? parseFloat(e.target.value) : undefined
                            updateSantaf({ width, length: 0 })
                          }} 
                          className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                        >
                          <option value="">בחר רוחב</option>
                          <option value="6">6 מ׳</option>
                          <option value="6.5">6.5 מ׳</option>
                          <option value="7">7 מ׳</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">אורך (מ׳)</label>
                        <input 
                          type="number" 
                          step="0.1" 
                          min="0" 
                          value={draft.santaf.length ?? 0} 
                          onChange={(e) => updateSantaf({ length: e.target.value ? parseFloat(e.target.value) : 0 })} 
                          className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed" 
                          placeholder="0"
                          disabled
                        />
                      </div>
                    </div>
                    {draft.santaf.width && draft.santaf.length && (
                      <div className="mt-2 text-sm text-white/60">
                        שטח מחושב: <span className="font-bold text-blue-400">{(draft.santaf.width * draft.santaf.length).toFixed(2)} מ״ר</span>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm text-white/80 mb-2">סוג סנטף</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="santafType" checked={!draft.santaf.withStructure} onChange={() => updateSantaf({ withStructure: false })} className="w-4 h-4" />
                      <span className="text-sm">סנטף בלבד</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="santafType" checked={draft.santaf.withStructure} onChange={() => updateSantaf({ withStructure: true })} className="w-4 h-4" />
                      <span className="text-sm">סנטף + קונסטרוקציה</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/80 mb-2">סוג חפיפה</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="santafOverlap" 
                        checked={(draft.santaf.overlapType || 'double') === 'single'} 
                        onChange={() => updateSantaf({ overlapType: 'single' })} 
                        className="w-4 h-4" 
                      />
                      <span className="text-sm">חפיפה אחת (0.988 מ׳)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="santafOverlap" 
                        checked={(draft.santaf.overlapType || 'double') === 'double'} 
                        onChange={() => updateSantaf({ overlapType: 'double' })} 
                        className="w-4 h-4" 
                      />
                      <span className="text-sm">חפיפה כפולה (0.969 מ׳) - מומלץ</span>
                    </label>
                  </div>
                  <p className="text-xs text-white/50 mt-1">חפיפה כפולה מומלצת על ידי היצרן</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/80 mb-1">מחיר סנטף בלבד (₪/מ״ר)</label>
                    <input type="number" step="10" min="0" value={draft.santaf.pricePerSqmBasic} onChange={(e) => updateSantaf({ pricePerSqmBasic: parseFloat(e.target.value) || 220 })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">מחיר סנטף + קונסטרוקציה (₪/מ״ר)</label>
                    <input type="number" step="10" min="0" value={draft.santaf.pricePerSqmWithStructure} onChange={(e) => updateSantaf({ pricePerSqmWithStructure: parseFloat(e.target.value) || 450 })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div className="text-sm text-white/60">סה״כ סנטף: <span className="font-bold text-green-400">{fmt(calculation.santafTotal)}</span></div>
              </div>
            )}
          </div>
          )}

          {/* ZIP Screen */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">מסך ZIP (סגירת חורף)</h3>
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <span className="text-sm text-white/80">הוסף ZIP</span>
                <input type="checkbox" checked={draft.zipScreen.enabled} onChange={(e) => { e.stopPropagation(); updateZipScreen({ enabled: e.target.checked }) }} className="w-5 h-5 rounded" />
              </label>
            </div>
            {draft.zipScreen.enabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/80 mb-2">סוג מנוע</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="zipType" value="manual" checked={draft.zipScreen.type === 'manual'} onChange={() => updateZipScreen({ type: 'manual' })} className="w-4 h-4" />
                      <span className="text-sm">ידני</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="zipType" value="electric" checked={draft.zipScreen.type === 'electric'} onChange={() => updateZipScreen({ type: 'electric' })} className="w-4 h-4" />
                      <span className="text-sm">חשמלי</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-white/80 mb-1">מחיר ידני (₪/מ״ר)</label>
                    <input type="number" step="10" min="0" value={draft.zipScreen.pricePerSqmManual} onChange={(e) => updateZipScreen({ pricePerSqmManual: parseFloat(e.target.value) || 650 })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">מחיר חשמלי (₪/מ״ר)</label>
                    <input type="number" step="10" min="0" value={draft.zipScreen.pricePerSqmElectric} onChange={(e) => updateZipScreen({ pricePerSqmElectric: parseFloat(e.target.value) || 800 })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">מטר רץ (אופציונלי)</label>
                    <input type="number" step="0.1" min="0" value={draft.zipScreen.runningMeters || ''} onChange={(e) => updateZipScreen({ runningMeters: e.target.value ? parseFloat(e.target.value) : undefined })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" placeholder="אוטומטי" />
                  </div>
                </div>
                <div className="text-sm text-white/60">סה״כ ZIP: <span className="font-bold text-green-400">{fmt(calculation.zipScreenTotal)}</span></div>
              </div>
            )}
          </div>

          {/* Winter Closure (Glass) - Multiple Items */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">סגירת חורף (זכוכית)</h3>
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <span className="text-sm text-white/80">הוסף סגירה</span>
                <input type="checkbox" checked={draft.winterClosure.enabled} onChange={(e) => { 
                  e.stopPropagation(); 
                  if (e.target.checked && draft.winterClosure.items.length === 0) {
                    // Add first item when enabled
                    updateWinterClosure({ enabled: true, items: [{ type: 'fixedGlass', area: 0, pricePerSqm: 750, notes: '' }] })
                  } else {
                    updateWinterClosure({ enabled: e.target.checked })
                  }
                }} className="w-5 h-5 rounded" />
              </label>
            </div>
            {draft.winterClosure.enabled && (
              <div className="space-y-4">
                {/* List of winter closure items */}
                {draft.winterClosure.items.map((item, index) => (
                  <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white/90">סגירה #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = draft.winterClosure.items.filter((_, i) => i !== index)
                          updateWinterClosure({ items: newItems })
                        }}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        ✕ הסר
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-white/80 mb-2">סוג סגירה</label>
                      <select
                        value={item.type}
                        onChange={(e) => {
                          const newItems = [...draft.winterClosure.items]
                          const type = e.target.value as typeof item.type
                          const prices: Record<string, number> = {
                            fixedGlass: 750,
                            windows7000: 950,
                            windows9000: 1050,
                            slidingShowcase7000: 1200,
                            slidingShowcase9000: 1800,
                            sliderGlass: 1650,
                            foldingGlass: 0,
                          }
                          newItems[index] = { ...item, type, pricePerSqm: prices[type] }
                          updateWinterClosure({ items: newItems })
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      >
                        <option value="fixedGlass">זכוכית קבועה (750 ₪/מ"ר)</option>
                        <option value="windows7000">חלונות 7000 (950 ₪/מ"ר)</option>
                        <option value="windows9000">חלונות 9000 (1,050 ₪/מ"ר)</option>
                        <option value="slidingShowcase7000">ויטרינה הזזה 7000 (1,200 ₪/מ"ר)</option>
                        <option value="slidingShowcase9000">ויטרינה הזזה 9000 (1,800 ₪/מ"ר)</option>
                        <option value="sliderGlass">זכוכית סליידר (1,650 ₪/מ"ר)</option>
                        <option value="foldingGlass">זכוכית מתקפלת (אחר)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-white/80 mb-2">שטח (מ"ר)</label>
                        <input
                          type="number"
                          value={item.area || ''}
                          onChange={(e) => {
                            const newItems = [...draft.winterClosure.items]
                            newItems[index] = { ...item, area: parseFloat(e.target.value) || 0 }
                            updateWinterClosure({ items: newItems })
                          }}
                          placeholder="שטח..."
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                          step="0.1"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/80 mb-2">מחיר למ"ר (₪)</label>
                        <input
                          type="number"
                          value={item.pricePerSqm || ''}
                          onChange={(e) => {
                            const newItems = [...draft.winterClosure.items]
                            newItems[index] = { ...item, pricePerSqm: parseFloat(e.target.value) || 0 }
                            updateWinterClosure({ items: newItems })
                          }}
                          placeholder="מחיר..."
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                          step="10"
                          min="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-white/80 mb-2">הערות (איזה צד?)</label>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => {
                          const newItems = [...draft.winterClosure.items]
                          newItems[index] = { ...item, notes: e.target.value }
                          updateWinterClosure({ items: newItems })
                        }}
                        placeholder="למשל: צד קדמי, צד ימני..."
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      />
                    </div>

                    {item.area > 0 && item.pricePerSqm > 0 && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
                        <span className="text-sm text-white/80">סכום: </span>
                        <span className="text-lg font-bold text-green-400">
                          {(item.area * item.pricePerSqm).toLocaleString('he-IL')} ₪
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Item Button */}
                <button
                  type="button"
                  onClick={() => {
                    const newItems = [...draft.winterClosure.items, { type: 'fixedGlass' as const, area: 0, pricePerSqm: 750, notes: '' }]
                    updateWinterClosure({ items: newItems })
                  }}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition"
                >
                  + הוסף עוד סוג סגירה
                </button>

                {/* Total */}
                {draft.winterClosure.items.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/80">סה"כ סגירת חורף:</span>
                      <span className="text-xl font-bold text-blue-400">
                        {draft.winterClosure.items.reduce((sum, item) => sum + (item.area * item.pricePerSqm), 0).toLocaleString('he-IL')} ₪
                      </span>
                    </div>
                  </div>
                )}

                {/* Glass Type (common for all) */}
                <div>
                  <label className="block text-sm text-white/80 mb-2">סוג זכוכית (לכל הסגירות)</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="winterClosureGlassType" value="tempered" checked={draft.winterClosure.glassType === 'tempered'} onChange={() => updateWinterClosure({ glassType: 'tempered' })} className="w-4 h-4" /><span className="text-sm">מחוסם</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="winterClosureGlassType" value="triplex" checked={draft.winterClosure.glassType === 'triplex'} onChange={() => updateWinterClosure({ glassType: 'triplex' })} className="w-4 h-4" /><span className="text-sm">טריפלקס</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="winterClosureGlassType" value="insulated" checked={draft.winterClosure.glassType === 'insulated'} onChange={() => updateWinterClosure({ glassType: 'insulated' })} className="w-4 h-4" /><span className="text-sm">בידודית</span></label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lighting */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">תאורה</h3>
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <span className="text-sm text-white/80">הוסף תאורה</span>
                <input type="checkbox" checked={draft.lighting.enabled} onChange={(e) => { e.stopPropagation(); updateLighting({ enabled: e.target.checked }) }} className="w-5 h-5 rounded" />
              </label>
            </div>
            {draft.lighting.enabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/80 mb-1">מחיר למטר רץ (₪)</label>
                    <input type="number" step="10" min="0" value={draft.lighting.pricePerMeter} onChange={(e) => updateLighting({ pricePerMeter: parseFloat(e.target.value) || 200 })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">מטר רץ</label>
                    <input type="number" step="0.1" min="0" value={draft.lighting.runningMeters || ''} onChange={(e) => updateLighting({ runningMeters: e.target.value ? parseFloat(e.target.value) : undefined })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" placeholder="כמות מטר" />
                  </div>
                </div>
                <div className="text-sm text-white/60">סה״כ תאורה: <span className="font-bold text-green-400">{fmt(calculation.lightingTotal)}</span></div>
              </div>
            )}
          </div>

          {/* Drainage */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">ניקוז</h3>
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <span className="text-sm text-white/80">הוסף ניקוז</span>
                <input type="checkbox" checked={draft.drainage.enabled} onChange={(e) => { e.stopPropagation(); updateDrainage({ enabled: e.target.checked }) }} className="w-5 h-5 rounded" />
              </label>
            </div>
            {draft.drainage.enabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/80 mb-1">מחיר למטר רץ (₪)</label>
                    <input type="number" step="10" min="0" value={draft.drainage.pricePerMeter} onChange={(e) => updateDrainage({ pricePerMeter: parseFloat(e.target.value) || 500 })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">מטר רץ</label>
                    <input type="number" step="0.1" min="0" value={draft.drainage.runningMeters || ''} onChange={(e) => updateDrainage({ runningMeters: e.target.value ? parseFloat(e.target.value) : undefined })} className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400" placeholder="כמות מטר" />
                  </div>
                </div>
                <div className="text-sm text-white/60">סה״כ ניקוז: <span className="font-bold text-green-400">{fmt(calculation.drainageTotal)}</span></div>
              </div>
            )}
          </div>

          {/* Notes with AI Improvement */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">הערות נוספות</h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    generateCompleteDescription()
                  }}
                  disabled={isGeneratingDescription}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm px-4 py-1 h-8 font-bold"
                >
                  {isGeneratingDescription ? '⏳ יוצר...' : '🤖 צור הצעה מקצועית'}
                </Button>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    improveNotesWithAI()
                  }}
                  disabled={isImprovingText || !draft.options.notes?.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1 h-8"
                >
                  {isImprovingText ? '⏳ משפר...' : '✨ שפר טקסט'}
                </Button>
              </div>
            </div>

            {/* Auto-generate hint */}
            {!draft.options.notes && (
              <div className="mb-3 p-3 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-400/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-2xl">💡</span>
                  <div>
                    <p className="text-sm font-semibold text-purple-300 mb-1">טיפ: צור הצעה אוטומטית!</p>
                    <p className="text-xs text-white/70">
                      לחץ על "🤖 צור הצעה מקצועית" וה-AI יכתוב עבורך תיאור יפה ומקצועי בהתבסס על כל הנתונים שהזנת!
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <textarea 
              value={draft.options.notes || ''} 
              onChange={(e) => {
                updateOptions({ notes: e.target.value || undefined })
                setAiSuggestion(null)
              }} 
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400 min-h-[80px]" 
              placeholder="הערות (לדוגמה: פרגולה בצבע שחור, זכוכית בצד דרום, התקנה כוללת...)"
            />
            
            {/* AI Suggestion */}
            {aiSuggestion && (
              <div className="mt-3 p-3 bg-purple-900/30 border border-purple-400/50 rounded-lg">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-300 text-sm font-semibold">💡 הצעת AI:</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        acceptAiSuggestion()
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 h-6"
                    >
                      ✓ קבל
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setAiSuggestion(null)
                      }}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs px-2 py-1 h-6"
                    >
                      ✕ דחה
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-white/90 whitespace-pre-wrap">{aiSuggestion}</p>
              </div>
            )}
          </div>

          {/* Price Summary - 3 PRICES */}
          <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-lg p-4 border border-blue-400/30">
            <h3 className="text-lg font-semibold mb-3">סיכום מחירים</h3>
            <div className="space-y-2 text-sm">
              {/* Components */}
              {calculation.railingsLineTotal != null && calculation.railingsLineTotal > 0 && (
                <div className="flex justify-between text-white/70">
                  <span>{tDeals('workTypes.railings')}:</span>
                  <span>{fmt(calculation.railingsLineTotal)}</span>
                </div>
              )}
              {calculation.fenceLineTotal != null && calculation.fenceLineTotal > 0 && (
                <div className="flex justify-between text-white/70">
                  <span>{tDeals('workTypes.fence')}:</span>
                  <span>{fmt(calculation.fenceLineTotal)}</span>
                </div>
              )}
              {calculation.pergolaTotal ? (
                <>
                  {getPergolas().map((pg, idx) => {
                    const area = pg?.shape ? calculatePergolaArea(pg.shape) : 0
                    const total = area * pg.pricePerSqm
                    const typeKey = pg.pergolaType === 'fixed' ? 'pergolaFixed' : pg.pergolaType === 'electricPvc' ? 'pergolaElectricPvc' : pg.pergolaType === 'electricBioclimatic' ? 'pergolaElectricBioclimatic' : null
                    const typeName = typeKey ? tDeals(typeKey) : tDeals('pergolaFixed')
                    return (
                      <div key={idx} className="flex justify-between text-white/70">
                        <span>{typeName}{getPergolas().length > 1 ? ` #${idx + 1}` : ''}:</span>
                        <span>{fmt(total)}</span>
                      </div>
                    )
                  })}
                </>
              ) : null}
              {calculation.santafTotal > 0 && (
                <div className="flex justify-between text-white/70">
                  <span>סנטף:</span>
                  <span>{fmt(calculation.santafTotal)}</span>
                </div>
              )}
              {calculation.zipScreenTotal > 0 && (
                <div className="flex justify-between text-white/70">
                  <span>מסך ZIP:</span>
                  <span>{fmt(calculation.zipScreenTotal)}</span>
                </div>
              )}
              {calculation.lightingTotal > 0 && (
                <div className="flex justify-between text-white/70">
                  <span>תאורה:</span>
                  <span>{fmt(calculation.lightingTotal)}</span>
                </div>
              )}
              {calculation.drainageTotal > 0 && (
                <div className="flex justify-between text-white/70">
                  <span>ניקוז:</span>
                  <span>{fmt(calculation.drainageTotal)}</span>
                </div>
              )}
              {draft.winterClosure.enabled && draft.winterClosure.items.length > 0 && (
                <>
                  {draft.winterClosure.items.map((item, index) => {
                    const typeNames: Record<string, string> = {
                      fixedGlass: 'זכוכית קבועה',
                      windows7000: 'חלונות 7000',
                      windows9000: 'חלונות 9000',
                      slidingShowcase7000: 'ויטרינה הזזה 7000',
                      slidingShowcase9000: 'ויטרינה הזזה 9000',
                      sliderGlass: 'זכוכית סליידר',
                      foldingGlass: 'זכוכית מתקפלת'
                    };
                    const typeName = typeNames[item.type] || item.type;
                    const itemTotal = item.area * item.pricePerSqm;
                    return (
                      <div key={index} className="flex justify-between text-white/70 text-xs">
                        <span className="truncate">{typeName} ({item.area.toFixed(2)} מ״ר){item.notes && ` - ${item.notes}`}</span>
                        <span>{fmt(itemTotal)}</span>
                      </div>
                    );
                  })}
                  {draft.winterClosure.items.length > 1 && (
                    <div className="flex justify-between text-white/80 font-semibold">
                      <span>סה״כ סגירת חורף:</span>
                      <span>{fmt(calculation.winterClosureTotal)}</span>
                    </div>
                  )}
                </>
              )}
              
              {/* 1. Price before VAT */}
              <div className="flex justify-between text-base font-bold border-t border-white/20 pt-2 mt-2">
                <span>לפני מע״מ:</span>
                <span className="text-blue-300">{fmt(calculation.totalBeforeVat)}</span>
              </div>
              
              {/* VAT */}
              <div className="flex justify-between items-center text-white/70">
                <span className="flex items-center gap-2 shrink-0">
                  מע״מ (%):
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={draft.vatPercent}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setDraft((prev) => ({
                        ...prev,
                        vatPercent: Number.isFinite(v)
                          ? Math.min(100, Math.max(0, v))
                          : DEFAULT_OFFER_VALUES.vatPercent,
                      }))
                    }}
                    className="w-16 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white text-left text-sm focus:outline-none focus:border-blue-400"
                  />
                </span>
                <span>+{fmt(calculation.vatAmount)}</span>
              </div>
              
              {/* 2. Price with VAT */}
              <div className="flex justify-between text-base font-bold border-t border-white/20 pt-2">
                <span>אחרי מע״מ:</span>
                <span className="text-green-300">{fmt(calculation.priceWithVat)}</span>
              </div>
              
              {/* Discount input */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-white/80">הנחה (%):</span>
                <input type="number" step="0.5" min="0" max="100" value={draft.discountPercent} onChange={(e) => setDraft(prev => ({ ...prev, discountPercent: parseFloat(e.target.value) || 0 }))} className="w-24 bg-white/10 border border-white/20 rounded px-3 py-1 text-white text-left focus:outline-none focus:border-blue-400" />
              </div>
              
              {/* Discount amount */}
              {draft.discountPercent > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>סכום הנחה:</span>
                  <span className="font-bold">-{fmt(calculation.discountAmount)}</span>
                </div>
              )}
              
              {/* 3. Final price */}
              <div className="flex justify-between text-2xl font-bold text-green-400 border-t-2 border-white/20 pt-3 mt-3">
                <span>מחיר סופי:</span>
                <span>{fmt(calculation.finalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Payment Terms & Warranty */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
              <div className="font-semibold mb-1">תנאי תשלום:</div>
              <div className="text-white/80">10% מקדמה וכל השאר בסיום התקנה בהעברה בנקאית</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm">
              <div className="font-semibold mb-1">אחריות:</div>
              <div className="text-white/80">7 שנים על צבע, קונסטרוקציה וסנטף</div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200">{error}</div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
            <Button type="button" variant="default" onClick={(e) => { e.stopPropagation(); onClose() }} disabled={isSubmitting} data-dialog-close className="bg-white/10 hover:bg-white/20 text-white border-white/20">ביטול</Button>
            <Button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); void handleSubmit() }} 
              disabled={isSubmitting || saveDisabled} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? 'שומר...' : 'שמור הצעת מחיר'}
            </Button>
          </div>
          </>
          ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <div className="rounded-lg border border-teal-500/40 bg-teal-950/30 p-4 text-sm text-white/90">
              <p className="font-semibold text-teal-200 mb-2">ההצעה נוצרה בהצלחה</p>
              <p className="text-white/75">
                קונפיגורטור 3D למטה מחובר להצעה. שמירה ב־3D מעדכנת מידות, תמונת תצוגה ומחירים. לשיתוף עם
                הלקוח השתמשו ב־&quot;העתק קישור ללקוח&quot; (תצוגה בלבד).
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="button"
                className="bg-teal-600 hover:bg-teal-500 text-white"
                disabled={configuratorUrls?.edit === undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  if (configuratorUrls?.edit) window.open(configuratorUrls.edit, '_blank', 'noopener,noreferrer')
                }}
              >
                פתיחה בלשונית חדשה
              </Button>
              <Button
                type="button"
                className="border-cyan-500/50 text-cyan-200 bg-transparent hover:bg-cyan-950/40"
                disabled={configuratorUrls?.customer === undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  void handleCopyCustomerConfiguratorLink()
                }}
              >
                <Copy className="w-4 h-4 ml-2" />
                העתק קישור ללקוח
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation()
                  handleFinishConfigurator()
                }}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 ms-auto"
              >
                סיום וסגירה
              </Button>
            </div>
            {configuratorLinkLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-white/70">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>טוען קונפיגורטור...</span>
              </div>
            ) : null}
            {configuratorLinkError ? (
              <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-red-200 text-sm flex flex-wrap items-center gap-3">
                <span>{configuratorLinkError}</span>
                <Button
                  type="button"
                  className="border-red-400/50 bg-transparent py-2 px-3 text-sm"
                  onClick={() => retryConfiguratorLink()}
                >
                  נסה שוב
                </Button>
              </div>
            ) : null}
            {configuratorUrls?.edit && createdOffer ? (
              <div className="flex min-h-[400px] flex-1 basis-0 flex-col overflow-hidden rounded-xl border border-white/15 bg-black/40 p-2 sm:p-3">
                <OfferConfiguratorEmbed
                  offerId={createdOffer.id}
                  locale={locale}
                  editUrl={configuratorUrls.edit}
                  offer={createdOffer}
                  onSaved={() => {
                    toast.success('נשמר מהקונפיגורטור — מידות והצעה עודכנו')
                  }}
                />
              </div>
            ) : null}
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
