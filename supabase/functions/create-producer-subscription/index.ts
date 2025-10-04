import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PRODUCER-SUBSCRIPTION] ${step}${detailsStr}`);
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
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { tier_id, producer_id } = await req.json();
    if (!tier_id || !producer_id) {
      throw new Error("tier_id and producer_id are required");
    }

    logStep("Request body parsed", { tier_id, producer_id });

    // Get tier details
    const { data: tier, error: tierError } = await supabaseClient
      .from("producer_subscription_tiers")
      .select("*")
      .eq("id", tier_id)
      .eq("producer_id", producer_id)
      .single();

    if (tierError || !tier) {
      throw new Error("Subscription tier not found");
    }

    logStep("Tier found", { tierName: tier.tier_name, price: tier.price_cents });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
      logStep("New customer created", { customerId });
    }

    // Create or get Stripe product and price
    let stripeProductId = tier.stripe_product_id;
    let stripePriceId = tier.stripe_price_id;

    if (!stripeProductId || !stripePriceId) {
      const product = await stripe.products.create({
        name: `${tier.tier_name.charAt(0).toUpperCase() + tier.tier_name.slice(1)} Tier - ${tier.monthly_download_limit} beats/month`,
        description: `${tier.monthly_download_limit} exclusive beat downloads per month`,
      });
      stripeProductId = product.id;
      logStep("Stripe product created", { productId: stripeProductId });

      const price = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: tier.price_cents,
        currency: "usd",
        recurring: { interval: "month" },
      });
      stripePriceId = price.id;
      logStep("Stripe price created", { priceId: stripePriceId });

      // Update tier with Stripe IDs
      await supabaseClient
        .from("producer_subscription_tiers")
        .update({
          stripe_product_id: stripeProductId,
          stripe_price_id: stripePriceId,
        })
        .eq("id", tier_id);
      
      logStep("Tier updated with Stripe IDs");
    }

    // Create checkout session
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/producer-dashboard?subscription=success`,
      cancel_url: `${origin}/producer-dashboard?subscription=canceled`,
      metadata: {
        fan_id: user.id,
        producer_id: producer_id,
        tier_id: tier_id,
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
