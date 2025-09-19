import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-BEAT-PRODUCT] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const { beatId } = await req.json();
    if (!beatId) {
      throw new Error("Missing beatId");
    }

    logStep("User authenticated", { userId: user.id, beatId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get beat and producer info
    const { data: beat, error: beatError } = await supabaseClient
      .from("beats")
      .select(`
        *,
        profiles!beats_producer_id_fkey(stripe_account_id, producer_name)
      `)
      .eq("id", beatId)
      .eq("producer_id", user.id)
      .single();

    if (beatError || !beat) {
      logStep("Beat not found or unauthorized", { beatId, error: beatError });
      throw new Error("Beat not found or unauthorized");
    }

    if (beat.stripe_product_id) {
      logStep("Beat already has Stripe product", { 
        productId: beat.stripe_product_id,
        priceId: beat.stripe_price_id 
      });
      return new Response(JSON.stringify({ 
        productId: beat.stripe_product_id, 
        priceId: beat.stripe_price_id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!beat.profiles?.stripe_account_id) {
      throw new Error("Producer Stripe account not configured");
    }

    logStep("Creating Stripe product", { 
      title: beat.title,
      stripeAccount: beat.profiles.stripe_account_id 
    });

    // Create Stripe product on connected account
    const product = await stripe.products.create(
      {
        name: beat.title,
        description: beat.description || `Beat by ${beat.profiles.producer_name || 'Unknown Producer'}`,
        metadata: { 
          beat_id: beatId, 
          producer_id: user.id 
        }
      },
      { stripeAccount: beat.profiles.stripe_account_id }
    );

    // Create Stripe price on connected account
    const price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: beat.is_free ? 0 : beat.price_cents,
        currency: "usd"
      },
      { stripeAccount: beat.profiles.stripe_account_id }
    );

    logStep("Stripe product and price created", { 
      productId: product.id, 
      priceId: price.id 
    });

    // Update beat record with Stripe IDs
    const { error: updateError } = await supabaseClient
      .from("beats")
      .update({
        stripe_product_id: product.id,
        stripe_price_id: price.id
      })
      .eq("id", beatId)
      .eq("producer_id", user.id);

    if (updateError) {
      logStep("Error updating beat with Stripe IDs", { error: updateError });
      throw new Error(`Failed to update beat: ${updateError.message}`);
    }

    logStep("Beat updated successfully with Stripe IDs");

    return new Response(JSON.stringify({ 
      productId: product.id, 
      priceId: price.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-beat-product", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});