import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BULK-UPDATE-BEATS] ${step}${detailsStr}`);
};

interface BeatUpdate {
  beatId: string;
  title?: string;
  priceCents?: number;
  isFree?: boolean;
  audioFileUrl?: string;
}

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { updates }: { updates: BeatUpdate[] } = await req.json();
    if (!updates || !Array.isArray(updates)) {
      throw new Error("Invalid updates array provided");
    }

    logStep("Processing bulk updates", { updateCount: updates.length });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const results = [];

    for (const update of updates) {
      try {
        logStep("Processing beat update", { beatId: update.beatId });

        // First, get the current beat to verify ownership and get current data
        const { data: currentBeat, error: fetchError } = await supabaseClient
          .from("beats")
          .select("*")
          .eq("id", update.beatId)
          .eq("producer_id", user.id)
          .single();

        if (fetchError || !currentBeat) {
          results.push({ 
            beatId: update.beatId, 
            success: false, 
            error: "Beat not found or access denied" 
          });
          continue;
        }

        // Prepare update data
        const updateData: any = {};
        if (update.title !== undefined) updateData.title = update.title;
        if (update.audioFileUrl !== undefined) updateData.audio_file_url = update.audioFileUrl;
        if (update.isFree !== undefined) updateData.is_free = update.isFree;
        if (update.priceCents !== undefined) {
          updateData.price_cents = update.isFree ? 0 : update.priceCents;
        }

        // Update Supabase record
        const { data: updatedBeat, error: updateError } = await supabaseClient
          .from("beats")
          .update(updateData)
          .eq("id", update.beatId)
          .eq("producer_id", user.id)
          .select("*")
          .single();

        if (updateError) {
          results.push({ 
            beatId: update.beatId, 
            success: false, 
            error: updateError.message 
          });
          continue;
        }

        logStep("Beat updated in database", { beatId: update.beatId });

        // Handle Stripe price updates for paid beats
        if (!update.isFree && update.priceCents && updatedBeat.stripe_product_id) {
          try {
            logStep("Creating new Stripe price", { 
              productId: updatedBeat.stripe_product_id,
              priceCents: update.priceCents 
            });

            // Create a new Stripe Price for the updated amount
            const newPrice = await stripe.prices.create({
              product: updatedBeat.stripe_product_id,
              unit_amount: update.priceCents,
              currency: "usd",
            });

            // Update beat record with new Stripe price ID
            await supabaseClient
              .from("beats")
              .update({ stripe_price_id: newPrice.id })
              .eq("id", update.beatId);

            logStep("Stripe price updated", { 
              beatId: update.beatId, 
              newPriceId: newPrice.id 
            });

          } catch (stripeError) {
            logStep("Stripe price update failed", { 
              beatId: update.beatId, 
              error: stripeError.message 
            });
            // Don't fail the entire operation for Stripe errors
          }
        }

        // If beat was made free, clear Stripe IDs
        if (update.isFree) {
          await supabaseClient
            .from("beats")
            .update({ 
              stripe_product_id: null, 
              stripe_price_id: null 
            })
            .eq("id", update.beatId);
          
          logStep("Cleared Stripe IDs for free beat", { beatId: update.beatId });
        }

        results.push({ 
          beatId: update.beatId, 
          success: true,
          updatedFields: Object.keys(updateData)
        });

      } catch (error) {
        logStep("Error updating beat", { 
          beatId: update.beatId, 
          error: error.message 
        });
        results.push({ 
          beatId: update.beatId, 
          success: false, 
          error: error.message 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logStep("Bulk update completed", { 
      total: results.length, 
      successful: successCount,
      failed: results.length - successCount
    });

    return new Response(JSON.stringify({ 
      success: true,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: results.length - successCount
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in bulk-update-beats", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});