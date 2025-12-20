/**
 * Stripe Payment Provider
 * For international market
 * Documentation: https://stripe.com/docs/api
 */

import Stripe from 'stripe'

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
  private stripe: Stripe

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY

    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-12-18.acacia',
    })
  }

  /**
   * Create customer
   */
  async createCustomer(params: {
    email: string
    name: string
    metadata?: Record<string, string>
  }): Promise<Stripe.Customer> {
    return await this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    })
  }

  /**
   * Create subscription
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<Stripe.Subscription> {
    console.log('[Stripe] Creating subscription:', {
      companyId: params.companyId,
      planId: params.planId,
      customer: params.customerEmail,
    })

    // 1. Create or get customer
    const customer = await this.createCustomer({
      email: params.customerEmail,
      name: params.customerName,
      metadata: {
        company_id: params.companyId,
        plan_id: params.planId,
      },
    })

    // 2. Attach payment method to customer
    await this.stripe.paymentMethods.attach(params.paymentMethodId, {
      customer: customer.id,
    })

    // 3. Set as default payment method
    await this.stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: params.paymentMethodId,
      },
    })

    // 4. Create subscription
    const subscription = await this.stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: params.priceId,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        company_id: params.companyId,
        plan_id: params.planId,
      },
    })

    console.log('[Stripe] Subscription created:', subscription.id)
    return subscription
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Stripe.Subscription> {
    console.log('[Stripe] Canceling subscription:', subscriptionId, { cancelAtPeriodEnd })

    if (cancelAtPeriodEnd) {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })
    } else {
      return await this.stripe.subscriptions.cancel(subscriptionId)
    }
  }

  /**
   * Update subscription (change plan)
   */
  async updateSubscription(
    subscriptionId: string,
    newPriceId: string
  ): Promise<Stripe.Subscription> {
    console.log('[Stripe] Updating subscription:', subscriptionId, 'to price:', newPriceId)

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId)
    
    return await this.stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations',
    })
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void> {
    console.log('[Stripe] Updating payment method for customer:', customerId)

    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    })

    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })
  }

  /**
   * Get subscription
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId)
  }

  /**
   * Create portal session (for customer self-service)
   */
  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    return await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
  }

  /**
   * Construct webhook event
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  }

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: any, signature: string): boolean {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('[Stripe] STRIPE_WEBHOOK_SECRET not configured')
      return false
    }

    try {
      this.constructWebhookEvent(payload, signature, webhookSecret)
      return true
    } catch (error) {
      console.error('[Stripe] Webhook verification failed:', error)
      return false
    }
  }
}

