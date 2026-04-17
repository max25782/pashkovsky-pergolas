-- Allow PayPal as a recorded payment_provider (manual / PayPal.me / hosted button)
ALTER TABLE public.company_subscriptions
  DROP CONSTRAINT IF EXISTS company_subscriptions_payment_provider_check;

ALTER TABLE public.company_subscriptions
  ADD CONSTRAINT company_subscriptions_payment_provider_check
  CHECK (
    payment_provider IS NULL
    OR payment_provider IN ('stripe', 'manual', 'bit', 'paybox', 'paypal')
  );
