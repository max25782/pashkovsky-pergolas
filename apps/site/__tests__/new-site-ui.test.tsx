import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { NewSiteApp } from '@/components/new-site/NewSiteApp'

function mockMatchMedia(reducedMotion: boolean): void {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }))
}

function renderApp() {
  const view = render(<NewSiteApp />)
  const root = view.container.querySelector('.ns-root') as HTMLElement
  return { ...view, root }
}

function switchToEnglish(): void {
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
}

describe('new site (/new)', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    mockMatchMedia(false)
    window.localStorage.clear()
    window.location.hash = ''
    window.scrollTo = jest.fn()
    Element.prototype.scrollIntoView = jest.fn()
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  describe('language, direction and theme', () => {
    it('starts in Hebrew right-to-left and switches to English left-to-right', () => {
      const { root } = renderApp()
      expect(root).toHaveAttribute('dir', 'rtl')
      expect(root).toHaveAttribute('lang', 'he')
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('פרגולות אלומיניום')

      switchToEnglish()
      expect(root).toHaveAttribute('dir', 'ltr')
      expect(root).toHaveAttribute('lang', 'en')
      expect(document.documentElement.dir).toBe('ltr')
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aluminum pergolas')
      expect(window.localStorage.getItem('ns-lang')).toBe('en')
    })

    it('toggles the theme and remembers it', () => {
      const { root } = renderApp()
      expect(root).not.toHaveAttribute('data-theme')
      fireEvent.click(screen.getByRole('button', { name: 'החלפת ערכת צבעים' }))
      expect(root).toHaveAttribute('data-theme', 'dark')
      fireEvent.click(screen.getByRole('button', { name: 'החלפת ערכת צבעים' }))
      expect(root).toHaveAttribute('data-theme', 'light')
      expect(window.localStorage.getItem('ns-theme')).toBe('light')
    })
  })

  describe('3D carousel', () => {
    it('opens and closes a panel with the keyboard and moves focus with the arrow keys', () => {
      renderApp()
      // The first match is the real panel; the looped clones are aria-hidden and not in the role query.
      const panels = screen.getAllByRole('button', { name: /פרגולה עם למלות/ })
      const first = panels[0]
      expect(first).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(first)
      expect(first).toHaveAttribute('aria-expanded', 'true')
      fireEvent.keyDown(first, { key: 'Escape' })
      expect(first).toHaveAttribute('aria-expanded', 'false')

      act(() => first.focus())
      fireEvent.keyDown(first, { key: 'ArrowRight' })
      expect(document.activeElement).toHaveAttribute('data-index', '1')
    })

    it('keeps cloned panels out of the accessibility tree and the tab order', () => {
      const { container } = renderApp()
      const clones = container.querySelectorAll('.ns-pan[aria-hidden="true"]')
      expect(clones.length).toBeGreaterThan(0)
      clones.forEach((clone) => expect(clone).toHaveAttribute('tabindex', '-1'))
    })

    it('offers a pause button for the automatic movement unless motion is already reduced', () => {
      renderApp()
      const pause = screen.getByRole('button', { name: 'עצירת הגלילה האוטומטית' })
      fireEvent.click(pause)
      expect(screen.getByRole('button', { name: 'הפעלת גלילה אוטומטית' })).toBeInTheDocument()
    })

    it('removes motion when the system asks for reduced motion', () => {
      mockMatchMedia(true)
      const { root } = renderApp()
      expect(root).toHaveClass('ns-still')
      expect(screen.queryByRole('button', { name: 'עצירת הגלילה האוטומטית' })).not.toBeInTheDocument()
      // arrows still work (instant step)
      fireEvent.click(screen.getByRole('button', { name: 'הבא' }))
    })
  })

  describe('works filter and calculator', () => {
    it('filters projects by type and marks the active chip', () => {
      const { container } = renderApp()
      switchToEnglish()
      expect(container.querySelectorAll('.ns-work')).toHaveLength(6)
      const railings = screen.getByRole('button', { name: 'Railings' })
      fireEvent.click(railings)
      expect(railings).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
      expect(container.querySelectorAll('.ns-work')).toHaveLength(1)
    })

    it('recalculates the estimate from the config when a size changes', () => {
      renderApp()
      switchToEnglish()
      expect(screen.getByText(/52,800/)).toBeInTheDocument()
      fireEvent.change(document.getElementById('ns-calc-width') as HTMLInputElement, { target: { value: '10' } })
      expect(screen.getByText(/88,000/)).toBeInTheDocument()
    })
  })

  describe('lead form', () => {
    function fillValidForm(): void {
      fireEvent.change(screen.getByLabelText(/First name/), { target: { value: 'Dan' } })
      fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: 'Levi' } })
      fireEvent.change(screen.getByLabelText(/^Phone/), { target: { value: '052-449-4848' } })
      fireEvent.change(screen.getByLabelText(/^City/), { target: { value: 'Haifa' } })
      fireEvent.click(screen.getByLabelText(/I agree to be contacted/))
    }

    it('validates, focuses the first problem and links the error to its field', () => {
      renderApp()
      switchToEnglish()
      fireEvent.click(screen.getByRole('button', { name: 'Send my request' }))
      const first = screen.getByLabelText(/First name/)
      expect(first).toHaveAttribute('aria-invalid', 'true')
      expect(first).toHaveFocus()
      const errorId = first.getAttribute('aria-describedby') as string
      expect(document.getElementById(errorId)).toHaveTextContent('Required')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('in demo mode shows success and sends nothing over the network', async () => {
      renderApp()
      switchToEnglish()
      fillValidForm()
      fireEvent.click(screen.getByRole('button', { name: 'Send my request' }))
      expect(await screen.findByText(/nothing was sent/)).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
      // the form is reset after success
      expect(screen.getByLabelText(/First name/)).toHaveValue('')
    })

    it('pretends success for a honeypot submission and sends nothing', async () => {
      const { container } = renderApp()
      switchToEnglish()
      fillValidForm()
      fireEvent.change(container.querySelector('#ns-f-website') as HTMLInputElement, { target: { value: 'http://spam.example' } })
      fireEvent.click(screen.getByRole('button', { name: 'Send my request' }))
      await waitFor(() => expect(container.querySelector('.ns-lstatus')).toHaveTextContent(/Thank you/))
      expect(container.querySelector('.ns-lstatus')).not.toHaveTextContent(/nothing was sent/)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('shows the detail fields of the chosen service', () => {
      renderApp()
      switchToEnglish()
      expect(screen.getByLabelText('Width (m)')).toBeInTheDocument()
      fireEvent.click(screen.getByLabelText('Fence'))
      expect(screen.queryByLabelText('Width (m)')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Total length (m)')).toBeInTheDocument()
    })

    it('has no axe violations', async () => {
      const { container } = renderApp()
      switchToEnglish()
      const form = container.querySelector('form') as HTMLElement
      expect(await axe(form)).toHaveNoViolations()
    })
  })

  describe('floating buttons', () => {
    it('adjusts text size, contrast and animations from the accessibility menu', () => {
      const { root } = renderApp()
      switchToEnglish()
      const toggle = screen.getByRole('button', { name: 'Accessibility menu' })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')

      fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
      expect(root.style.getPropertyValue('--fs')).toBe('20px')
      fireEvent.click(screen.getByRole('button', { name: 'High contrast' }))
      expect(root).toHaveClass('ns-contrast')
      fireEvent.click(screen.getByRole('button', { name: 'Stop animations' }))
      expect(root).toHaveClass('ns-still')

      fireEvent.keyDown(toggle, { key: 'Escape' })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(toggle).toHaveFocus()
    })

    it('links WhatsApp with the shared contact number', () => {
      renderApp()
      switchToEnglish()
      const wa = screen.getAllByRole('link', { name: 'WhatsApp' }).find((a) => a.className.includes('ns-fab-wa'))
      expect(wa).toHaveAttribute('href', expect.stringContaining('wa.me/972524494848'))
    })
  })

  describe('AI chat (demo)', () => {
    it('opens a modal dialog, answers from the local keyword base and closes with Escape', async () => {
      renderApp()
      switchToEnglish()
      fireEvent.click(screen.getByRole('button', { name: 'Open AI chat' }))
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      const input = within(dialog).getByLabelText('Message')
      expect(input).toHaveFocus()

      fireEvent.change(input, { target: { value: 'What is the warranty?' } })
      fireEvent.submit(input.closest('form') as HTMLFormElement)
      expect(await screen.findByText(/warranty details are on the site/)).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()

      await act(async () => {
        fireEvent.keyDown(dialog, { key: 'Escape' })
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('accessibility page', () => {
    it('replaces the home page when the hash is #accessibility and has no axe violations', async () => {
      window.location.hash = '#accessibility'
      const { container } = renderApp()
      expect(await screen.findByRole('heading', { level: 1, name: 'הצהרת נגישות' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /פרגולות אלומיניום שנבנות/ })).not.toBeInTheDocument()
      expect(await axe(container.querySelector('article') as HTMLElement)).toHaveNoViolations()
    })

    it('returns to the home page when the hash changes', async () => {
      window.location.hash = '#accessibility'
      renderApp()
      await screen.findByRole('heading', { level: 1, name: 'הצהרת נגישות' })
      await act(async () => {
        window.location.hash = '#top'
      })
      expect(await screen.findByRole('heading', { level: 1, name: /פרגולות אלומיניום שנבנות/ })).toBeInTheDocument()
    })
  })

  it('home page has no axe violations (page-level landmark rules aside)', async () => {
    const { container } = renderApp()
    const results = await axe(container, { rules: { region: { enabled: false } } })
    expect(results).toHaveNoViolations()
  })
})
