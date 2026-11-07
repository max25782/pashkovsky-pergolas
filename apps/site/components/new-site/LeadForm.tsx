'use client'

import { useRef, useState, type FormEvent } from 'react'
import { TurnstileWidget } from '@/components/captcha/TurnstileWidget'
import { defaultDetails, getService, SERVICES, type ServiceId } from '@/lib/new-site/lead-fields'
import { isLeadDemo } from '@/lib/new-site/lead-mode'
import { buildLeadPayload, LEAD_LIMITS, validateLead, type LeadErrorCode, type LeadErrors, type LeadFormValues } from '@/lib/new-site/lead-schema'
import { copy, t } from './i18n'
import { useNewSite } from './NewSiteProvider'

type Status = 'idle' | 'sending' | 'ok' | 'demo-ok' | 'fail'

const INITIAL_SERVICE: ServiceId = 'pergola'

function initialValues(): LeadFormValues {
  return {
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    email: '',
    message: '',
    service: INITIAL_SERVICE,
    details: defaultDetails(INITIAL_SERVICE),
    consent: false,
    website: '',
  }
}

function fieldId(key: string): string {
  return `ns-f-${key.replace('.', '-')}`
}

/**
 * Lead form. In Preview (NEXT_PUBLIC_LEADS_DEMO is not 'false') it validates and shows success
 * without any network call. Only a production build with the flag set to 'false' posts to /api/leads,
 * which itself refuses unless its own server-side flags allow it.
 */
export function LeadForm() {
  const { lang } = useNewSite()
  const [values, setValues] = useState<LeadFormValues>(initialValues)
  const [errors, setErrors] = useState<LeadErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const demo = isLeadDemo()
  const formRef = useRef<HTMLFormElement>(null)
  const service = getService(values.service)

  function patch(partial: Partial<LeadFormValues>): void {
    setValues((prev) => ({ ...prev, ...partial }))
  }

  function errorText(key: string): string | null {
    const code: LeadErrorCode | undefined = errors[key]
    return code === undefined ? null : t(copy.lead.errors[code], lang)
  }

  /** Common attributes of a field that can show an error. */
  function a11yFor(key: string): { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined } {
    const invalid = errors[key] !== undefined
    return { id: fieldId(key), 'aria-invalid': invalid, 'aria-describedby': invalid ? `${fieldId(key)}-err` : undefined }
  }

  function renderError(name: string) {
    const text = errorText(name)
    return text === null ? null : (
      <p id={`${fieldId(name)}-err`} className="ns-err">
        {text}
      </p>
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (status === 'sending') return

    const found = validateLead(values)
    setErrors(found)
    const firstKey = Object.keys(found)[0]
    if (firstKey !== undefined) {
      setStatus('idle')
      formRef.current?.querySelector<HTMLElement>(`#${fieldId(firstKey)}`)?.focus()
      return
    }

    // Honeypot: a bot filled the hidden field. Look successful, send nothing.
    if (values.website.trim() !== '') {
      setStatus('ok')
      setValues(initialValues())
      return
    }

    if (demo) {
      setStatus('demo-ok')
      setValues(initialValues())
      return
    }

    if (turnstileToken === null) {
      setStatus('fail') // the CAPTCHA has not finished (or expired); the CRM would reject the lead anyway
      return
    }

    setStatus('sending')
    try {
      const payload = buildLeadPayload(values, { lang, pageUrl: window.location.href, search: window.location.search })
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, 'cf-turnstile-response': turnstileToken }),
      })
      if (!response.ok) throw new Error(`leads api responded ${response.status}`)
      setStatus('ok')
      setValues(initialValues())
    } catch (error) {
      console.error('[new-site] lead was not sent', error)
      setStatus('fail')
    }
  }

  const statusText =
    status === 'ok'
      ? t(copy.lead.ok, lang)
      : status === 'demo-ok'
        ? `${t(copy.lead.ok, lang)} ${t(copy.lead.demoNote, lang)}`
        : status === 'fail'
          ? t(copy.lead.fail, lang)
          : status === 'sending'
            ? t(copy.lead.sending, lang)
            : ''

  return (
    <form ref={formRef} className="ns-lform" noValidate onSubmit={onSubmit}>
      <div className="ns-row">
        <div>
          <label className="ns-l ns-req" htmlFor={fieldId('firstName')}>
            {t(copy.lead.firstName, lang)}
          </label>
          <input
            {...a11yFor('firstName')}
            type="text"
            autoComplete="given-name"
            maxLength={LEAD_LIMITS.firstName}
            value={values.firstName}
            onChange={(e) => patch({ firstName: e.target.value })}
          />
          {renderError('firstName')}
        </div>
        <div>
          <label className="ns-l ns-req" htmlFor={fieldId('lastName')}>
            {t(copy.lead.lastName, lang)}
          </label>
          <input
            {...a11yFor('lastName')}
            type="text"
            autoComplete="family-name"
            maxLength={LEAD_LIMITS.lastName}
            value={values.lastName}
            onChange={(e) => patch({ lastName: e.target.value })}
          />
          {renderError('lastName')}
        </div>
      </div>

      <div className="ns-row">
        <div>
          <label className="ns-l ns-req" htmlFor={fieldId('phone')}>
            {t(copy.lead.phone, lang)}
          </label>
          <input
            {...a11yFor('phone')}
            type="tel"
            dir="ltr"
            autoComplete="tel"
            inputMode="tel"
            maxLength={LEAD_LIMITS.phone}
            placeholder="052-000-0000"
            value={values.phone}
            onChange={(e) => patch({ phone: e.target.value })}
          />
          {renderError('phone')}
        </div>
        <div>
          <label className="ns-l ns-req" htmlFor={fieldId('city')}>
            {t(copy.lead.city, lang)}
          </label>
          <input
            {...a11yFor('city')}
            type="text"
            autoComplete="address-level2"
            maxLength={LEAD_LIMITS.city}
            value={values.city}
            onChange={(e) => patch({ city: e.target.value })}
          />
          {renderError('city')}
        </div>
      </div>

      <div>
        <label className="ns-l" htmlFor={fieldId('email')}>
          {t(copy.lead.email, lang)} <small>{t(copy.lead.optional, lang)}</small>
        </label>
        <input
          {...a11yFor('email')}
          type="email"
          dir="ltr"
          autoComplete="email"
          maxLength={LEAD_LIMITS.email}
          value={values.email}
          onChange={(e) => patch({ email: e.target.value })}
        />
        {renderError('email')}
      </div>

      <fieldset>
        <legend>{t(copy.lead.service, lang)}</legend>
        <div className="ns-svc">
          {SERVICES.map((item) => (
            <span key={item.id}>
              <input
                id={`ns-svc-${item.id}`}
                type="radio"
                name="service"
                value={item.id}
                checked={values.service === item.id}
                onChange={() => patch({ service: item.id, details: defaultDetails(item.id) })}
              />
              <label htmlFor={`ns-svc-${item.id}`}>{t(item.label, lang)}</label>
            </span>
          ))}
        </div>
      </fieldset>

      {(service.fields.length > 0 || service.hint !== undefined) && (
        <div className="ns-cond">
          {service.fields.length > 0 && (
            <div className="ns-row3">
              {service.fields.map((field) => {
                const key = `details.${field.name}`
                return (
                  <div key={`${service.id}-${field.name}`}>
                    <label className="ns-l" htmlFor={fieldId(key)}>
                      {t(field.label, lang)}
                    </label>
                    {field.kind === 'select' ? (
                      <select
                        {...a11yFor(key)}
                        value={values.details[field.name] ?? ''}
                        onChange={(e) => patch({ details: { ...values.details, [field.name]: e.target.value } })}
                      >
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(option.label, lang)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        {...a11yFor(key)}
                        type="number"
                        dir="ltr"
                        inputMode="decimal"
                        step="any"
                        min={LEAD_LIMITS.numberMin}
                        max={LEAD_LIMITS.numberMax}
                        value={values.details[field.name] ?? ''}
                        onChange={(e) => patch({ details: { ...values.details, [field.name]: e.target.value } })}
                      />
                    )}
                    {renderError(key)}
                  </div>
                )
              })}
            </div>
          )}
          {service.hint !== undefined && <p className="ns-hint">{t(service.hint, lang)}</p>}
        </div>
      )}

      <div>
        <label className="ns-l" htmlFor="ns-f-message">
          {t(copy.lead.message, lang)} <small>{t(copy.lead.optional, lang)}</small>
        </label>
        <textarea id="ns-f-message" maxLength={LEAD_LIMITS.message} value={values.message} onChange={(e) => patch({ message: e.target.value })} />
      </div>

      {/* Honeypot: invisible and unreachable for people; bots tend to fill it. */}
      <div className="ns-hp" aria-hidden="true">
        <label htmlFor="ns-f-website">Website</label>
        <input id="ns-f-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => patch({ website: e.target.value })} />
      </div>

      <div>
        <label className="ns-consent" htmlFor={fieldId('consent')}>
          <input
            {...a11yFor('consent')}
            type="checkbox"
            checked={values.consent}
            onChange={(e) => patch({ consent: e.target.checked })}
          />
          <span>{t(copy.lead.consent, lang)}</span>
        </label>
        {renderError('consent')}
      </div>

      {/* The CRM verifies a Cloudflare Turnstile token; the widget is only mounted when real sending is on. */}
      {!demo && <TurnstileWidget onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />}

      <button type="submit" className="ns-btn ns-btn-a" disabled={status === 'sending'}>
        {t(status === 'sending' ? copy.lead.sending : copy.lead.send, lang)}
      </button>
      <p role="status" aria-live="polite" className={`ns-lstatus${status === 'ok' || status === 'demo-ok' ? ' ns-ok' : status === 'fail' ? ' ns-bad' : ''}`}>
        {statusText}
      </p>
    </form>
  )
}
