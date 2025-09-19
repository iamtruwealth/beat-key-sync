import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This should match your actual Stripe product ID for pro plan
const PRO_PRODUCT_ID = "prod_T56eWAaDmlFdSl";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
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

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type });
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle subscription events
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;

      logStep("Processing subscription event", { 
        eventType: event.type,
        subscriptionId: subscription.id,
        customerId: stripeCustomerId,
        status: subscription.status
      });

      // Determine if this is a pro plan
      const isPro = subscription.status === 'active' && 
                   subscription.items.data.some(
                     (item) => item.price.product === PRO_PRODUCT_ID
                   );

      const newPlan = isPro ? "pro" : "free";
      logStep("Determined plan", { newPlan, subscriptionStatus: subscription.status });

      // Find the user with this Stripe customer ID
      const { data: paymentInfo, error: paymentError } = await supabaseAdmin
        .from("user_payment_info")
        .select("user_id")
        .eq("stripe_customer_id", stripeCustomerId)
        .single();

      if (paymentError || !paymentInfo) {
        logStep("No user found for Stripe customer", { 
          customerId: stripeCustomerId,
          error: paymentError 
        });
        return new Response("No user found for this customer", { status: 404 });
      }

      // Update the user's plan
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ plan: newPlan })
        .eq("id", paymentInfo.user_id);

      if (updateError) {
        logStep("Error updating user plan", { 
          userId: paymentInfo.user_id,
          error: updateError 
        });
        throw new Error(`Failed to update user plan: ${updateError.message}`);
      }

      logStep("Successfully updated user plan", { 
        userId: paymentInfo.user_id,
        newPlan,
        eventType: event.type 
      });
    }

    // Handle other relevant events
    else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      logStep("Payment failed", { invoiceId: invoice.id, customerId: invoice.customer });
      
      // Optionally downgrade to free plan on payment failure
      if (invoice.customer) {
        const { data: paymentInfo } = await supabaseAdmin
          .from("user_payment_info")
          .select("user_id")
          .eq("stripe_customer_id", invoice.customer as string)
          .single();

        if (paymentInfo) {
          await supabaseAdmin
            .from("profiles")
            .update({ plan: "free" })
            .eq("id", paymentInfo.user_id);
          
          logStep("Downgraded user to free plan due to payment failure", { 
            userId: paymentInfo.user_id 
          });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});