import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-WELCOME-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { subscription_id, fan_email, tier_name, artist_id } = await req.json();
    logStep("Request body parsed", { subscription_id, fan_email, tier_name, artist_id });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get custom welcome message template if exists
    const { data: welcomeTemplate } = await supabaseClient
      .from("subscription_welcome_messages")
      .select("*")
      .eq("artist_id", artist_id)
      .eq("tier_name", tier_name)
      .single();

    logStep("Welcome template loaded", { hasTemplate: !!welcomeTemplate });

    // Get artist profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("producer_name, first_name, last_name")
      .eq("id", artist_id)
      .single();

    const artistName = profile?.producer_name || `${profile?.first_name} ${profile?.last_name}` || "Your Favorite Artist";

    // Build email content
    const subject = welcomeTemplate?.subject || `Welcome to ${artistName}'s Fan Club!`;
    const messageBody = welcomeTemplate?.message_body || `
Thank you for subscribing to my ${tier_name.replace("_", " ")} tier!

I'm thrilled to have you as part of my inner circle. As a subscriber, you'll get exclusive access to:
- Behind-the-scenes content
- Early music releases
- Direct communication with me
- And much more!

Stay tuned for exclusive content coming your way.

Best,
${artistName}
    `;

    let downloadLinksHtml = "";
    if (welcomeTemplate?.include_download_links && welcomeTemplate?.download_urls) {
      const urls = welcomeTemplate.download_urls as string[];
      downloadLinksHtml = `
<div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
  <h3>🎁 Your Exclusive Downloads:</h3>
  <ul>
    ${urls.map((url: string) => `<li><a href="${url}">${url}</a></li>`).join("")}
  </ul>
</div>
      `;
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #8B5CF6, #EC4899); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    a { color: #8B5CF6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${artistName}'s Fan Club!</h1>
      <p>You're now a ${tier_name.replace("_", " ")} subscriber</p>
    </div>
    <div class="content">
      <p style="white-space: pre-wrap;">${messageBody}</p>
      ${downloadLinksHtml}
    </div>
    <div class="footer">
      <p>You're receiving this email because you subscribed to ${artistName} on Beatpackz</p>
      <p>© ${new Date().getFullYear()} Beatpackz. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Beatpackz <onboarding@resend.dev>",
      to: [fan_email],
      subject: subject,
      html: emailHtml,
    });

    logStep("Email sent successfully", { emailId: emailResponse.id });

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logStep("ERROR in send-welcome-email", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
