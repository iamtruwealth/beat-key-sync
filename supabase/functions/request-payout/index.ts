import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REQUEST-PAYOUT] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const { payoutMethod, payoutDetails, amountCents } = await req.json();
    
    if (!payoutMethod || !payoutDetails || !amountCents) {
      throw new Error("Missing required payout information");
    }

    logStep("Payout request received", { 
      userId: user.id, 
      payoutMethod, 
      amountCents 
    });

    // Validate payout method
    const validMethods = ['stripe', 'paypal', 'venmo', 'cashapp'];
    if (!validMethods.includes(payoutMethod)) {
      throw new Error("Invalid payout method");
    }

    // Check user's available balance
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("available_balance_cents")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      logStep("Profile not found", { error: profileError });
      throw new Error("Profile not found");
    }

    if (profile.available_balance_cents < amountCents) {
      throw new Error("Insufficient balance for payout request");
    }

    // Create payout request
    const { data: payoutRequest, error: payoutError } = await supabaseClient
      .from("payout_requests")
      .insert({
        producer_id: user.id,
        amount_cents: amountCents,
        payout_method: payoutMethod,
        payout_details: payoutDetails,
        status: 'pending'
      })
      .select()
      .single();

    if (payoutError) {
      logStep("Error creating payout request", { error: payoutError });
      throw new Error(`Failed to create payout request: ${payoutError.message}`);
    }

    // Update available balance (reserve the amount)
    const { error: balanceError } = await supabaseClient
      .from("profiles")
      .update({
        available_balance_cents: profile.available_balance_cents - amountCents
      })
      .eq("id", user.id);

    if (balanceError) {
      logStep("Error updating balance", { error: balanceError });
      // Try to rollback the payout request
      await supabaseClient
        .from("payout_requests")
        .delete()
        .eq("id", payoutRequest.id);
      
      throw new Error("Failed to process payout request");
    }

    logStep("Payout request created successfully", { 
      payoutRequestId: payoutRequest.id,
      amountCents,
      payoutMethod 
    });

    return new Response(JSON.stringify({ 
      success: true, 
      payoutRequestId: payoutRequest.id,
      message: "Payout request submitted successfully" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in request-payout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});