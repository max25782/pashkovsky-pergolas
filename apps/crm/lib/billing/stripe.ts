/**
 * Stripe Payment Provider
 * For international market
 * Documentation: https://stripe.com/docs/api
 * 
 * TODO: Install stripe package when ready to implement:
 * npm install stripe
 */

// import Stripe from 'stripe'

export interface CreateSubscriptionParams {
  companyId: string
  planId: string
  customerEmail: string
  customerName: string
  paymentMethodId: string // Stripe payment method ID
  billingInterval: 'month' | 'year'
  priceId: string // Stripe price ID
}

export class StripeProvider {
  // private stripe: Stripe

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY

    if (!apiKey) {
      console.warn('[Stripe] STRIPE_SECRET_KEY not configured - Stripe disabled')
      return
    }

    // this.stripe = new Stripe(apiKey, {
    //   apiVersion: '2024-12-18.acacia',
    // })
  }

  /**
   * Create customer - PLACEHOLDER
   */
  async createCustomer(params: {
    email: string
    name: string
    metadata?: Record<string, string>
  }): Promise<any> {
    throw new Error('Stripe not implemented yet')
  }

  /**
   * Create subscription - PLACEHOLDER
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<any> {
    throw new Error('Stripe not implemented yet')
  }

  /**
   * Cancel subscription - PLACEHOLDER
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<any> {
    throw new Error('Stripe not implemented yet')
  }
}

