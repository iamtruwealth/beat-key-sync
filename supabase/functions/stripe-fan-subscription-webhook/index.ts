import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    logStep("ERROR: Missing signature or webhook secret");
    return new Response("Webhook signature missing", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    logStep("ERROR: Webhook signature verification failed", { error: err.message });
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  logStep("Event received", { type: event.type, id: event.id });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id });

        const { tier_id, artist_id, fan_id } = session.metadata || {};
        
        if (!tier_id || !artist_id || !fan_id) {
          logStep("ERROR: Missing metadata", session.metadata);
          break;
        }

        // Create or update fan subscription
        const { error: subError } = await supabaseClient
          .from("fan_subscriptions")
          .upsert({
            fan_id,
            artist_id,
            tier_id,
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            status: "active",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

        if (subError) {
          logStep("ERROR: Failed to create subscription", { error: subError });
        } else {
          logStep("Subscription created", { fan_id, artist_id });
          
          // Send welcome email
          await supabaseClient.functions.invoke("send-welcome-email", {
            body: { fan_id, artist_id, tier_id },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { subscriptionId: subscription.id });

        const { error } = await supabaseClient
          .from("fan_subscriptions")
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("ERROR: Failed to update subscription", { error });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });

        const { error } = await supabaseClient
          .from("fan_subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("ERROR: Failed to cancel subscription", { error });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment succeeded", { invoiceId: invoice.id });

        // Get subscription details
        const { data: subscription } = await supabaseClient
          .from("fan_subscriptions")
          .select("fan_id, artist_id, tier_id")
          .eq("stripe_subscription_id", invoice.subscription as string)
          .single();

        if (subscription) {
          const { data: tier } = await supabaseClient
            .from("fan_subscription_tiers")
            .select("price_cents")
            .eq("id", subscription.tier_id)
            .single();

          if (tier) {
            const amountCents = tier.price_cents;
            const platformFeeCents = Math.round(amountCents * 0.12);
            const artistEarningsCents = amountCents - platformFeeCents;

            // Record payment
            await supabaseClient
              .from("fan_subscription_payments")
              .insert({
                subscription_id: subscription.fan_id,
                fan_id: subscription.fan_id,
                artist_id: subscription.artist_id,
                amount_cents: amountCents,
                platform_fee_cents: platformFeeCents,
                artist_earnings_cents: artistEarningsCents,
                stripe_payment_intent_id: invoice.payment_intent as string,
              });

            logStep("Payment recorded", { amount: amountCents });
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("ERROR in webhook handler", { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
