import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration constants
const FREE_MAX_ACCOUNTS = 1;
const PRO_MAX_ACCOUNTS = 3;
const MAX_ATTEMPTS_PER_HOUR = 5;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SIGNUP-IP-GUARD] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Create Supabase client using service role key for admin operations
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { email, password, userAgent } = await req.json();
    
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    // Extract IP address from request
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || 
              req.headers.get("cf-connecting-ip") || 
              "unknown";
    
    logStep("IP extracted", { ip, userAgent });

    // --- 1. Fail-safe check: quick ping to Supabase ---
    const { error: healthError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .limit(1);

    if (healthError) {
      logStep("Supabase health check failed", { error: healthError });
      return new Response(
        JSON.stringify({ error: "Signups temporarily disabled. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- 2. Rate limiting ---
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from("signup_attempts")
      .select("id")
      .eq("ip_address", ip)
      .gte("attempted_at", oneHourAgo);

    if (attemptsError) {
      logStep("Error checking signup attempts", { error: attemptsError });
      return new Response(
        JSON.stringify({ error: "Signups temporarily disabled. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (attempts && attempts.length >= MAX_ATTEMPTS_PER_HOUR) {
      logStep("Rate limit exceeded", { attemptCount: attempts.length, ip });
      return new Response(
        JSON.stringify({ error: "Too many signup attempts. Try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record this signup attempt
    await supabaseAdmin.from("signup_attempts").insert({ 
      ip_address: ip,
      user_agent: userAgent,
      success: false // Will update to true if signup succeeds
    });

    // --- 3. Account per IP limits ---
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, plan")
      .eq("ip_address", ip);

    if (profilesError) {
      logStep("Error checking existing profiles", { error: profilesError });
      return new Response(
        JSON.stringify({ error: "Signups temporarily disabled. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profiles && profiles.length > 0) {
      // Check what plan level allows for this IP
      const hasProUser = profiles.some(profile => profile.plan === 'pro');
      const maxAccounts = hasProUser ? PRO_MAX_ACCOUNTS : FREE_MAX_ACCOUNTS;
      const planType = hasProUser ? 'pro' : 'free';

      logStep("Checking account limits", { 
        existingAccounts: profiles.length, 
        maxAccounts, 
        planType,
        ip 
      });

      if (profiles.length >= maxAccounts) {
        return new Response(
          JSON.stringify({
            error: `Limit reached: ${maxAccounts} account(s) allowed per IP for ${planType} plan.`,
            currentAccounts: profiles.length,
            maxAccounts,
            planType
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- 4. Proceed with signup ---
    logStep("Creating user account", { email });
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for faster testing
      user_metadata: {
        ip_address: ip,
        created_via: 'ip-guard-signup'
      }
    });

    if (authError) {
      logStep("Auth signup error", { error: authError });
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error("Failed to create user");
    }

    // Update the profile with IP address
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ ip_address: ip })
      .eq("id", authData.user.id);

    if (profileUpdateError) {
      logStep("Profile update error", { error: profileUpdateError });
      // Don't fail the signup for this, just log it
    }

    // Mark signup attempt as successful
    await supabaseAdmin
      .from("signup_attempts")
      .update({ success: true })
      .eq("ip_address", ip)
      .gte("attempted_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order("attempted_at", { ascending: false })
      .limit(1);

    logStep("Signup successful", { userId: authData.user.id, email });

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user.id,
          email: authData.user.email,
          created_at: authData.user.created_at
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in signup-with-ip-guard", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: (error instanceof Error && error.message.includes("temporarily disabled")) ? 503 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});