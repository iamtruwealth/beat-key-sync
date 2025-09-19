import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_MAX_ACCOUNTS = 1;
const PRO_MAX_ACCOUNTS = 3;
const MAX_ATTEMPTS_PER_HOUR = 5;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-IP-LIMITS] ${step}${detailsStr}`);
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
    logStep("Function started");

    // Extract IP address from request
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || 
              req.headers.get("cf-connecting-ip") || 
              "unknown";
    
    logStep("Checking limits for IP", { ip });

    // Check recent signup attempts
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from("signup_attempts")
      .select("id, success")
      .eq("ip_address", ip)
      .gte("attempted_at", oneHourAgo);

    if (attemptsError) {
      logStep("Error checking signup attempts", { error: attemptsError });
      throw new Error("Unable to check signup limits");
    }

    const recentAttempts = attempts?.length || 0;
    const canAttemptSignup = recentAttempts < MAX_ATTEMPTS_PER_HOUR;

    // Check existing accounts for this IP
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, plan")
      .eq("ip_address", ip);

    if (profilesError) {
      logStep("Error checking existing profiles", { error: profilesError });
      throw new Error("Unable to check account limits");
    }

    const existingAccounts = profiles?.length || 0;
    const hasProUser = profiles?.some(profile => profile.plan === 'pro') || false;
    const maxAccounts = hasProUser ? PRO_MAX_ACCOUNTS : FREE_MAX_ACCOUNTS;
    const planType = hasProUser ? 'pro' : 'free';
    const canCreateAccount = existingAccounts < maxAccounts;

    const result = {
      ip,
      limits: {
        signupAttempts: {
          current: recentAttempts,
          max: MAX_ATTEMPTS_PER_HOUR,
          canAttempt: canAttemptSignup,
          resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        },
        accounts: {
          current: existingAccounts,
          max: maxAccounts,
          planType,
          canCreate: canCreateAccount,
          hasProUser
        }
      },
      canSignup: canAttemptSignup && canCreateAccount
    };

    logStep("Limits check complete", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-ip-limits", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});