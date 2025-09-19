import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PERCENT = 12;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BEAT-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Webhook received");

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type });
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle payment completion
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      const payment = event.data.object as any;
      const beatId = payment.metadata?.beat_id;
      const producerId = payment.metadata?.producer_id;
      const buyerEmail = payment.metadata?.buyer_email;

      logStep("Processing beat sale", { 
        eventType: event.type,
        beatId,
        producerId,
        buyerEmail,
        amount: payment.amount_total || payment.amount
      });

      if (beatId && producerId && buyerEmail) {
        const amountReceived = payment.amount_total || payment.amount || 0;
        const platformFee = Math.floor(amountReceived * (PLATFORM_FEE_PERCENT / 100));

        // Record the sale
        const { error: saleError } = await supabaseAdmin
          .from("beat_sales")
          .insert({
            beat_id: beatId,
            producer_id: producerId,
            buyer_email: buyerEmail,
            amount_received: amountReceived,
            platform_fee: platformFee,
            stripe_payment_intent_id: payment.payment_intent || payment.id,
          });

        if (saleError) {
          logStep("Error recording beat sale", { error: saleError });
          throw new Error(`Failed to record sale: ${saleError.message}`);
        }

        // Update producer earnings
        const producerEarnings = amountReceived - platformFee;
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            total_earnings_cents: supabaseAdmin.raw(`total_earnings_cents + ${producerEarnings}`),
            available_balance_cents: supabaseAdmin.raw(`available_balance_cents + ${producerEarnings}`),
          })
          .eq("id", producerId);

        if (profileError) {
          logStep("Error updating producer earnings", { error: profileError });
        }

        logStep("Beat sale recorded successfully", { 
          beatId,
          producerId,
          amountReceived,
          platformFee,
          producerEarnings
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in beat-webhook", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});