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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
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

    const body = await req.json();
    const { beatId, title, description, priceCents } = body;
    if (!beatId) {
      throw new Error("Missing beatId");
    }

    logStep("User authenticated", { userId: user.id, beatId, title, priceCents });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get beat owned by the user
    const { data: beat, error: beatError } = await supabaseClient
      .from("beats")
      .select("*")
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

    // For now, create products on the main platform account instead of connected accounts
    // Later this can be enhanced to support connected accounts for direct payouts
    const useConnectedAccount = false; // future: support connected accounts

    // Fetch producer profile for display metadata (optional)
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("producer_name, stripe_account_id")
      .eq("id", user.id)
      .maybeSingle();

    logStep("Creating Stripe product", { 
      title: title || beat.title,
      useConnectedAccount
    });

    // Create Stripe product (on main platform account for now)
    const product = await stripe.products.create({
      name: title || beat.title,
      description: description || beat.description || `Beat by ${profile?.producer_name || 'Unknown Producer'}`,
      metadata: { 
        beat_id: beatId, 
        producer_id: user.id 
      }
    });

    // Create Stripe price (on main platform account for now)
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: priceCents || (beat.is_free ? 0 : beat.price_cents),
      currency: "usd"
    });

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