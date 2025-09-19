import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PERCENT = 12; // 12% platform fee

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-BEAT-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const { beatId, buyerEmail } = await req.json();
    if (!beatId || !buyerEmail) {
      throw new Error("Missing beatId or buyerEmail");
    }

    logStep("Request data received", { beatId, buyerEmail });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get beat details
    const { data: beat, error: beatError } = await supabaseClient
      .from("beats")
      .select(`
        *,
        profiles!beats_producer_id_fkey(stripe_account_id, producer_name)
      `)
      .eq("id", beatId)
      .single();

    if (beatError || !beat) {
      logStep("Beat not found", { beatId, error: beatError });
      throw new Error("Beat not found");
    }

    logStep("Beat retrieved", { title: beat.title, price: beat.price_cents });

    if (beat.is_free) {
      // For free beats, just record the download
      const { error: downloadError } = await supabaseClient
        .from("beat_sales")
        .insert({
          beat_id: beatId,
          producer_id: beat.producer_id,
          buyer_email: buyerEmail,
          amount_received: 0,
          platform_fee: 0,
        });

      if (downloadError) {
        logStep("Error recording free download", { error: downloadError });
        throw new Error("Failed to record download");
      }

      return new Response(JSON.stringify({ 
        success: true, 
        downloadUrl: beat.audio_file_url,
        message: "Free beat download recorded"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For paid beats, create Stripe checkout
    if (!beat.profiles?.stripe_account_id) {
      throw new Error("Producer Stripe account not configured");
    }

    const platformFee = Math.floor(beat.price_cents * (PLATFORM_FEE_PERCENT / 100));
    
    logStep("Creating checkout session", { 
      price: beat.price_cents, 
      platformFee,
      stripeAccount: beat.profiles.stripe_account_id 
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: beat.title,
            description: `Beat by ${beat.profiles.producer_name || 'Unknown Producer'}`,
            metadata: {
              beat_id: beatId,
              producer_id: beat.producer_id
            }
          },
          unit_amount: beat.price_cents,
        },
        quantity: 1,
      }],
      customer_email: buyerEmail,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: beat.profiles.stripe_account_id,
        },
        metadata: {
          beat_id: beatId,
          producer_id: beat.producer_id,
          buyer_email: buyerEmail,
        }
      },
      success_url: `${req.headers.get("origin")}/beat-purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/beats/${beatId}`,
      metadata: {
        beat_id: beatId,
        producer_id: beat.producer_id,
        buyer_email: buyerEmail,
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-beat-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});