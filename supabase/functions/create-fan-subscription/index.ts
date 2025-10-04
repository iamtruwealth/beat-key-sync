import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-FAN-SUBSCRIPTION] ${step}${detailsStr}`);
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
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { tier_id, artist_id } = await req.json();
    logStep("Request body parsed", { tier_id, artist_id });

    // Get tier details
    const { data: tier, error: tierError } = await supabaseClient
      .from("fan_subscription_tiers")
      .select("*")
      .eq("id", tier_id)
      .single();

    if (tierError || !tier) throw new Error("Subscription tier not found");
    logStep("Tier loaded", { tierName: tier.tier_name, price: tier.price_cents });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
          artist_id: artist_id,
        },
      });
      customerId = customer.id;
      logStep("Created new customer", { customerId });
    }

    // Create or get Stripe price
    let stripePriceId = tier.stripe_price_id;

    if (!stripePriceId) {
      // Create product if doesn't exist
      let stripeProductId = tier.stripe_product_id;

      if (!stripeProductId) {
        const product = await stripe.products.create({
          name: `Fan Subscription - ${tier.tier_name}`,
          description: `${tier.tier_name} tier subscription`,
        });
        stripeProductId = product.id;
        logStep("Created Stripe product", { productId: stripeProductId });

        await supabaseClient
          .from("fan_subscription_tiers")
          .update({ stripe_product_id: stripeProductId })
          .eq("id", tier_id);
      }

      // Create price
      const price = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: tier.price_cents,
        currency: "usd",
        recurring: { interval: "month" },
      });
      stripePriceId = price.id;
      logStep("Created Stripe price", { priceId: stripePriceId });

      await supabaseClient
        .from("fan_subscription_tiers")
        .update({ stripe_price_id: stripePriceId })
        .eq("id", tier_id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/epk/${artist_id}?subscription=success`,
      cancel_url: `${req.headers.get("origin")}/epk/${artist_id}?subscription=canceled`,
      metadata: {
        tier_id: tier_id,
        artist_id: artist_id,
        fan_id: user.id,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-fan-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
