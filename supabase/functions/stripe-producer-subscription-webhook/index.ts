import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const logStep = (step: string, details?: any) => {
  console.log(`[PRODUCER-SUBSCRIPTION-WEBHOOK] ${step}`, details || '');
};

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    logStep("ERROR: Missing signature or webhook secret");
    return new Response("Webhook signature or secret missing", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );

    logStep("Event received", { type: event.type, id: event.id });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id });

        const fan_id = session.metadata?.fan_id;
        const producer_id = session.metadata?.producer_id;
        const tier_id = session.metadata?.tier_id;

        if (!fan_id || !producer_id || !tier_id) {
          throw new Error("Missing metadata in checkout session");
        }

        const { error: subError } = await supabaseClient
          .from("producer_subscriptions")
          .upsert({
            fan_id,
            producer_id,
            tier_id,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            status: "active",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            downloads_used: 0,
          }, {
            onConflict: "fan_id,producer_id"
          });

        if (subError) throw subError;

        logStep("Subscription created/updated");
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { subscriptionId: subscription.id });

        const { error: updateError } = await supabaseClient
          .from("producer_subscriptions")
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            // Reset downloads_used at the start of a new billing period
            downloads_used: 0,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (updateError) throw updateError;
        logStep("Subscription status updated");
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });

        const { error: deleteError } = await supabaseClient
          .from("producer_subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (deleteError) throw deleteError;
        logStep("Subscription marked as canceled");
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment succeeded", { invoiceId: invoice.id });

        if (invoice.subscription) {
          const { data: subscription } = await supabaseClient
            .from("producer_subscriptions")
            .select("*, producer_subscription_tiers(*)")
            .eq("stripe_subscription_id", invoice.subscription)
            .single();

          if (subscription) {
            const amountCents = invoice.amount_paid;
            const platformFee = Math.floor(amountCents * 0.12);
            const producerEarnings = amountCents - platformFee;

            const { error: paymentError } = await supabaseClient
              .from("producer_subscription_payments")
              .insert({
                subscription_id: subscription.id,
                fan_id: subscription.fan_id,
                producer_id: subscription.producer_id,
                amount_cents: amountCents,
                platform_fee_cents: platformFee,
                producer_earnings_cents: producerEarnings,
                stripe_payment_intent_id: invoice.payment_intent as string,
              });

            if (paymentError) throw paymentError;
            logStep("Payment recorded");
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    logStep("ERROR", { error: err.message });
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
