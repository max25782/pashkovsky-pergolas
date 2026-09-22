import { axe } from 'jest-axe'
import { ACCESSIBILITY_COORDINATOR } from '@/lib/accessibility'
import heMessages from '../../messages/he.json'

describe('landing accessibility', () => {
  it('exposes coordinator contact details', () => {
    expect(ACCESSIBILITY_COORDINATOR.email).toBeTruthy()
    expect(ACCESSIBILITY_COORDINATOR.phone).toBeTruthy()
    expect(ACCESSIBILITY_COORDINATOR.name).toBeTruthy()
  })

  it('includes accessibility statement translations', () => {
    expect(heMessages.accessibility.title).toBe('הצהרת נגישות')
    expect(heMessages.footer.accessibility).toBe('הצהרת נגישות')
    expect(heMessages.accessibility.skipToContent).toBe('דלג לתוכן הראשי')
  })

  it('skip link markup has no axe violations inside a page landmark', async () => {
    document.body.innerHTML = `
      <header><a href="#main-content">Skip to main content</a></header>
      <main id="main-content"><h1>AluminCRM</h1></main>
    `
    const results = await axe(document.body)
    expect(results).toHaveNoViolations()
  })
})
