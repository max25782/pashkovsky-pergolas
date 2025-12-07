import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { OfferPdfTemplate } from './offer-pdf-template'
import type { Offer } from '@/types/offer'

/**
 * Generate PDF buffer from offer data
 * @param offer - The offer object
 * @returns Promise<Buffer> - PDF file as buffer
 */
export async function generateOfferPdf(offer: Offer): Promise<Buffer> {
  try {
    // Render React PDF component to buffer
    const pdfBuffer = await renderToBuffer(<OfferPdfTemplate offer={offer} />)
    
    return Buffer.from(pdfBuffer)
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Failed to generate PDF')
  }
}

/**
 * Generate filename for offer PDF
 * @param offer - The offer object
 * @returns string - formatted filename
 */
export function generateOfferPdfFilename(offer: Offer): string {
  const date = new Date(offer.createdAt).toISOString().split('T')[0]
  const customerName = offer.customerName.replace(/[^a-zA-Z0-9א-ת]/g, '_')
  return `offer_${offer.id}_${customerName}_${date}.pdf`
}

