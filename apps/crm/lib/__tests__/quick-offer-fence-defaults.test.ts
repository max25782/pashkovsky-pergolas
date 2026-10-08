import { fenceVariantChangePatch } from '../quick-offer-fence-defaults'

describe('fenceVariantChangePatch', () => {
  it('applies the new type defaults when values are still the previous defaults', () => {
    expect(
      fenceVariantChangePatch({ fenceVariant: 'classic', pricePerSqm: 750, slatGapCm: 1 }, 'hitech'),
    ).toEqual({ fenceVariant: 'hitech', pricePerSqm: 900, slatGapCm: 2 })

    expect(
      fenceVariantChangePatch({ fenceVariant: 'hitech', pricePerSqm: 900, slatGapCm: 2 }, 'hitech_angular'),
    ).toEqual({ fenceVariant: 'hitech_angular', pricePerSqm: 1200, slatGapCm: 2 })
  })

  it('keeps a price or gap the user changed by hand', () => {
    expect(
      fenceVariantChangePatch({ fenceVariant: 'classic', pricePerSqm: 800, slatGapCm: 1.5 }, 'hitech'),
    ).toEqual({ fenceVariant: 'hitech' })
  })

  it('fills the gap for drafts saved before the field existed', () => {
    expect(
      fenceVariantChangePatch({ fenceVariant: 'classic', pricePerSqm: 800 }, 'hitech'),
    ).toEqual({ fenceVariant: 'hitech', slatGapCm: 2 })
  })
})
