import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[NOTIFY-CONTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;

    const artist = userData.user;
    if (!artist) throw new Error("User not authenticated");

    logStep("Artist authenticated", { artistId: artist.id });

    const { post_id } = await req.json();
    if (!post_id) throw new Error("Missing post_id");

    // Get post details
    const { data: post, error: postError } = await supabaseClient
      .from("artist_exclusive_posts")
      .select("title, preview_text, required_tier")
      .eq("id", post_id)
      .eq("artist_id", artist.id)
      .single();

    if (postError) throw postError;
    if (!post) throw new Error("Post not found");

    logStep("Post found", { postId: post_id, title: post.title });

    // Get artist profile
    const { data: artistProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("producer_name")
      .eq("id", artist.id)
      .single();

    if (profileError) throw profileError;

    // Get subscribers for this tier
    const { data: subscriptions, error: subsError } = await supabaseClient
      .from("fan_subscriptions")
      .select(`
        fan_id,
        tier:fan_subscription_tiers(tier_name)
      `)
      .eq("artist_id", artist.id)
      .eq("status", "active");

    if (subsError) throw subsError;

    if (!subscriptions || subscriptions.length === 0) {
      logStep("No active subscribers found");
      return new Response(JSON.stringify({ message: "No subscribers to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Filter subscribers based on tier access
    const eligibleFanIds = subscriptions
      .filter((sub) => {
        const tierName = sub.tier?.tier_name;
        if (post.required_tier === "fan") return true;
        if (post.required_tier === "super_fan") {
          return tierName === "super_fan" || tierName === "ultra_fan";
        }
        if (post.required_tier === "ultra_fan") {
          return tierName === "ultra_fan";
        }
        return false;
      })
      .map((sub) => sub.fan_id);

    logStep("Eligible fans found", { count: eligibleFanIds.length });

    // Get fan emails
    const { data: fans, error: fansError } = await supabaseClient.auth.admin.listUsers();
    if (fansError) throw fansError;

    const eligibleEmails = fans.users
      .filter((user) => eligibleFanIds.includes(user.id))
      .map((user) => user.email)
      .filter((email): email is string => email !== undefined);

    logStep("Sending emails", { emailCount: eligibleEmails.length });

    // Send emails in batches
    const batchSize = 50;
    for (let i = 0; i < eligibleEmails.length; i += batchSize) {
      const batch = eligibleEmails.slice(i, i + batchSize);

      await resend.emails.send({
        from: `${artistProfile.producer_name} <onboarding@resend.dev>`,
        to: batch,
        subject: `New Exclusive Content: ${post.title}`,
        html: `
          <h1>New Exclusive Content from ${artistProfile.producer_name}</h1>
          <h2>${post.title}</h2>
          <p>${post.preview_text || "Check out this new exclusive content just for you!"}</p>
          <p>
            <a href="${Deno.env.get("SUPABASE_URL")}/my-subscriptions" 
               style="background-color: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Content
            </a>
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            You're receiving this because you're subscribed to ${artistProfile.producer_name}.
          </p>
        `,
      });
    }

    logStep("Emails sent successfully");

    return new Response(
      JSON.stringify({ success: true, notified_count: eligibleEmails.length }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    logStep("ERROR", { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
