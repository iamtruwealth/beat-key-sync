import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    console.log("[CAN-CREATE-BEATPACK] Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    console.log(`[CAN-CREATE-BEATPACK] User authenticated: ${user.id}`);

    // Get user profile with current beat pack count and plan
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("plan, beat_pack_count")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("[CAN-CREATE-BEATPACK] Profile error:", profileError);
      throw new Error("Could not fetch user profile");
    }

    console.log(`[CAN-CREATE-BEATPACK] User plan: ${profile.plan}, beat packs: ${profile.beat_pack_count}`);

    // Pro users have unlimited beat packs
    if (profile.plan === "pro") {
      console.log("[CAN-CREATE-BEATPACK] Pro user - unlimited beat packs");
      return new Response(JSON.stringify({ 
        canCreate: true, 
        reason: "Pro plan - unlimited beat packs",
        packsLeft: "unlimited"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Free users are limited to 1 beat pack
    const packLimit = 1;
    const packsUsed = profile.beat_pack_count || 0;
    const canCreate = packsUsed < packLimit;
    const packsLeft = packLimit - packsUsed;

    if (canCreate) {
      // Increment the beat pack count
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ beat_pack_count: packsUsed + 1 })
        .eq("id", user.id);

      if (updateError) {
        console.error("[CAN-CREATE-BEATPACK] Update error:", updateError);
        throw new Error("Could not update beat pack count");
      }

      console.log(`[CAN-CREATE-BEATPACK] Beat pack creation allowed - ${packsLeft - 1} packs remaining`);
    } else {
      console.log("[CAN-CREATE-BEATPACK] Beat pack limit reached");
    }

    return new Response(JSON.stringify({ 
      canCreate,
      reason: canCreate ? `Beat pack created - ${packsLeft - 1} packs remaining` : "Beat pack limit reached (1/1)",
      packsLeft: canCreate ? packsLeft - 1 : 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CAN-CREATE-BEATPACK] ERROR:", errorMessage);
    return new Response(JSON.stringify({ 
      canCreate: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});