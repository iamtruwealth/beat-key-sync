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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
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
      .select("*")
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

    // Get producer details for paid beats (optional)
    const { data: producer, error: producerError } = await supabaseClient
      .from("profiles")
      .select("stripe_account_id, producer_name")
      .eq("id", beat.producer_id)
      .maybeSingle();

    const platformFee = Math.floor(beat.price_cents * (PLATFORM_FEE_PERCENT / 100));

    logStep("Creating checkout session", {
      price: beat.price_cents,
      platformFee,
      stripeAccount: producer?.stripe_account_id || null,
    });

    // Create line items: beat + service fee
    const lineItems = [];
    
    // Add the beat as the first line item
    if (beat.stripe_price_id) {
      lineItems.push({ price: beat.stripe_price_id as string, quantity: 1 });
    } else {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: beat.title,
            description: `Beat by ${producer?.producer_name || 'Unknown Producer'}`,
            metadata: { beat_id: beatId, producer_id: beat.producer_id }
          },
          unit_amount: beat.price_cents,
        },
        quantity: 1,
      });
    }
    
    // Add the 12% service fee as a separate line item
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Service Fee",
          description: "Platform service fee (12%)",
        },
        unit_amount: platformFee,
      },
      quantity: 1,
    });

    const baseParams: any = {
      mode: "payment",
      line_items: lineItems,
      customer_email: buyerEmail,
      success_url: `${req.headers.get("origin")}/beat-purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/beats/${beatId}`,
      metadata: { beat_id: beatId, producer_id: beat.producer_id, buyer_email: buyerEmail },
    };

    // If producer has a connected account, route funds via transfer_data
    if (producer?.stripe_account_id) {
      baseParams.payment_intent_data = {
        application_fee_amount: platformFee,
        transfer_data: { destination: producer.stripe_account_id },
        metadata: { beat_id: beatId, producer_id: beat.producer_id, buyer_email: buyerEmail },
      };
    }

    const session = await stripe.checkout.sessions.create(baseParams);

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