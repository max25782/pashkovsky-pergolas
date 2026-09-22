import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { SkipToMain } from '@/components/SkipToMain'

describe('site accessibility', () => {
  it('renders skip link targeting main content', () => {
    const { getByRole } = render(<SkipToMain locale="he" />)
    const link = getByRole('link', { name: 'דלג לתוכן הראשי' })
    expect(link).toHaveAttribute('href', '#main-content')
  })

  it('skip link has no axe violations', async () => {
    const { container } = render(<SkipToMain locale="en" />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
