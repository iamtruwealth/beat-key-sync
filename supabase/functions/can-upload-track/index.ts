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
    console.log("[CAN-UPLOAD-TRACK] Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    console.log(`[CAN-UPLOAD-TRACK] User authenticated: ${user.id}`);

    // Get user profile with current upload count and plan
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("plan, track_upload_count")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("[CAN-UPLOAD-TRACK] Profile error:", profileError);
      throw new Error("Could not fetch user profile");
    }

    console.log(`[CAN-UPLOAD-TRACK] User plan: ${profile.plan}, uploads: ${profile.track_upload_count}`);

    // Pro users have unlimited uploads
    if (profile.plan === "pro") {
      console.log("[CAN-UPLOAD-TRACK] Pro user - unlimited uploads");
      return new Response(JSON.stringify({ 
        canUpload: true, 
        reason: "Pro plan - unlimited uploads",
        uploadsLeft: "unlimited"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Free users are limited to 10 uploads
    const uploadLimit = 10;
    const uploadsUsed = profile.track_upload_count || 0;
    const canUpload = uploadsUsed < uploadLimit;
    const uploadsLeft = uploadLimit - uploadsUsed;

    if (canUpload) {
      // Increment the upload count
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ track_upload_count: uploadsUsed + 1 })
        .eq("id", user.id);

      if (updateError) {
        console.error("[CAN-UPLOAD-TRACK] Update error:", updateError);
        throw new Error("Could not update upload count");
      }

      console.log(`[CAN-UPLOAD-TRACK] Upload allowed - ${uploadsLeft - 1} uploads remaining`);
    } else {
      console.log("[CAN-UPLOAD-TRACK] Upload limit reached");
    }

    return new Response(JSON.stringify({ 
      canUpload,
      reason: canUpload ? `Upload successful - ${uploadsLeft - 1} uploads remaining` : "Upload limit reached (10/10)",
      uploadsLeft: canUpload ? uploadsLeft - 1 : 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CAN-UPLOAD-TRACK] ERROR:", errorMessage);
    return new Response(JSON.stringify({ 
      canUpload: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});