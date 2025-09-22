import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PERCENT = 10;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CART-WEBHOOK] ${step}${detailsStr}`);
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

  const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");

  try {
    logStep("Cart webhook received");

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

    // Handle payment completion for cart purchases
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const cartItems = JSON.parse(session.metadata?.cart_items || "[]");
      const buyerEmail = session.customer_email || session.customer_details?.email;
      const userId = session.metadata?.user_id;

      logStep("Processing cart purchase", { 
        sessionId: session.id,
        cartItemsCount: cartItems.length,
        buyerEmail,
        userId
      });

      if (!buyerEmail || !cartItems.length) {
        logStep("Missing required data for cart processing");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Process each cart item
      for (const cartItem of cartItems) {
        const { item_type, item_id, quantity, price_cents } = cartItem;

        if (item_type === 'beat') {
          // Get beat details
          const { data: beat, error: beatError } = await supabaseAdmin
            .from('beats')
            .select('*, profiles!beats_producer_id_fkey(producer_name)')
            .eq('id', item_id)
            .single();

          if (beatError || !beat) {
            logStep("Error fetching beat", { error: beatError, beatId: item_id });
            continue;
          }

          // Record the sale
          const platformFee = Math.floor(price_cents * (PLATFORM_FEE_PERCENT / 100));
          const { error: saleError } = await supabaseAdmin
            .from("beat_sales")
            .insert({
              beat_id: item_id,
              producer_id: beat.producer_id,
              buyer_email: buyerEmail,
              amount_received: price_cents,
              platform_fee: platformFee,
              stripe_payment_intent_id: session.payment_intent as string,
            });

          if (saleError) {
            logStep("Error recording beat sale", { error: saleError });
            continue;
          }

          // Update producer earnings
          const producerEarnings = price_cents - platformFee;
          await supabaseAdmin
            .from("profiles")
            .update({
              total_earnings_cents: supabaseAdmin.raw(`total_earnings_cents + ${producerEarnings}`),
              available_balance_cents: supabaseAdmin.raw(`available_balance_cents + ${producerEarnings}`),
            })
            .eq("id", beat.producer_id);

          // Send beat download link via email
          try {
            await resend.emails.send({
              from: 'BeatPackz <downloads@beatpackz.com>',
              to: [buyerEmail],
              subject: `Your Beat Download - ${beat.title}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">Thank you for your purchase!</h2>
                  <p>Hi there,</p>
                  <p>Thanks for purchasing <strong>${beat.title}</strong> by ${beat.profiles?.producer_name || 'Unknown Producer'}.</p>
                  
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Download Your Beat</h3>
                    <p><strong>Beat:</strong> ${beat.title}</p>
                    <p><strong>Producer:</strong> ${beat.profiles?.producer_name || 'Unknown Producer'}</p>
                    <a href="${beat.file_url}" 
                       style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
                      Download Beat
                    </a>
                  </div>
                  
                  <p style="color: #666; font-size: 14px;">
                    Please save this email as your download receipt. If you have any issues downloading your beat, please contact support.
                  </p>
                  
                  <p>Happy creating!</p>
                  <p>The BeatPackz Team</p>
                </div>
              `,
            });
            logStep("Beat download email sent", { beatId: item_id, buyerEmail });
          } catch (emailError) {
            logStep("Error sending beat download email", { error: emailError });
          }
        }
      }

      // Clear the user's cart after successful purchase
      if (userId) {
        await supabaseAdmin
          .from('cart_items')
          .delete()
          .eq('user_id', userId);
        logStep("Cart cleared for user", { userId });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in cart webhook", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});