import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CART-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Cart checkout started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user's cart items
    const { data: cartItems, error: cartError } = await supabaseClient
      .from('cart_items')
      .select('*')
      .eq('user_id', user.id);

    if (cartError) throw cartError;
    if (!cartItems || cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    logStep("Cart items found", { itemCount: cartItems.length });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Calculate platform fee (10%)
    const platformFeePercent = 10;
    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);
    const platformFee = Math.round(totalAmount * platformFeePercent / 100);

    logStep("Calculated fees", { totalAmount, platformFee });

    // Create line items for Stripe
    const lineItems = [];
    
    // Add cart items
    for (const item of cartItems) {
      let itemData;
      if (item.item_type === 'beat') {
        const { data: beat } = await supabaseClient
          .from('beats')
          .select('title, producer_id')
          .eq('id', item.item_id)
          .single();
        itemData = beat;
      } else {
        const { data: pack } = await supabaseClient
          .from('beat_packs')
          .select('name as title, user_id as producer_id')
          .eq('id', item.item_id)
          .single();
        itemData = pack;
      }

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: itemData?.title || 'Digital Product',
          },
          unit_amount: item.price_cents,
        },
        quantity: item.quantity,
      });
    }

    // Add platform fee as a line item
    if (platformFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Platform Fee',
          },
          unit_amount: platformFee,
        },
        quantity: 1,
      });
    }

    logStep("Line items created", { lineItemCount: lineItems.length });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/explore`,
      metadata: {
        user_id: user.id,
        cart_items: JSON.stringify(cartItems.map(item => ({ 
          id: item.id, 
          item_type: item.item_type, 
          item_id: item.item_id, 
          quantity: item.quantity,
          price_cents: item.price_cents
        }))),
        platform_fee: platformFee.toString()
      }
    });

    logStep("Stripe session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in cart checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});