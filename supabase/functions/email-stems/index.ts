import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailStemsRequest {
  beatId: string;
  customerEmail: string;
  customerName?: string;
  purchaseId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Email stems function started");

    // Create Supabase client using service role key for admin access
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { beatId, customerEmail, customerName, purchaseId }: EmailStemsRequest = await req.json();
    console.log("Request data:", { beatId, customerEmail, customerName, purchaseId });

    if (!beatId || !customerEmail) {
      throw new Error("Beat ID and customer email are required");
    }

    // Get beat information
    const { data: beat, error: beatError } = await supabaseClient
      .from('beats')
      .select(`
        id,
        title,
        artist,
        profiles!beats_producer_id_fkey(producer_name, first_name, last_name)
      `)
      .eq('id', beatId)
      .single();

    if (beatError || !beat) {
      console.error("Beat not found:", beatError);
      throw new Error("Beat not found");
    }

    console.log("Beat found:", beat);

    // Get stems for this beat
    const { data: stems, error: stemsError } = await supabaseClient
      .from('stems')
      .select('*')
      .eq('beat_id', beatId);

    if (stemsError) {
      console.error("Error fetching stems:", stemsError);
      throw new Error("Failed to fetch stems");
    }

    console.log(`Found ${stems?.length || 0} stems for beat`);

    if (!stems || stems.length === 0) {
      console.log("No stems found for this beat");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No stems available for this beat" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Prepare download links for stems
    const stemLinks = stems.map(stem => {
      return `<li><strong>${stem.name}</strong>: <a href="${stem.file_url}" download="${stem.name}">${stem.name}</a></li>`;
    }).join('\n');

    const producerName = beat.profiles?.producer_name || 
                        `${beat.profiles?.first_name || ''} ${beat.profiles?.last_name || ''}`.trim() || 
                        'Unknown Producer';

    // Send email with stems
    const emailResponse = await resend.emails.send({
      from: "BeatPackz <stems@resend.dev>",
      to: [customerEmail],
      subject: `Your Stems for "${beat.title}" - BeatPackz`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin-bottom: 10px;">Your Stems Are Ready!</h1>
            <p style="color: #666; font-size: 16px;">Thank you for your purchase</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h2 style="color: #333; margin-top: 0;">Beat Information</h2>
            <p><strong>Title:</strong> ${beat.title}</p>
            ${beat.artist ? `<p><strong>Artist:</strong> ${beat.artist}</p>` : ''}
            <p><strong>Producer:</strong> ${producerName}</p>
            ${purchaseId ? `<p><strong>Purchase ID:</strong> ${purchaseId}</p>` : ''}
          </div>

          <div style="margin-bottom: 30px;">
            <h3 style="color: #333;">Download Your Stems</h3>
            <p style="color: #666; margin-bottom: 15px;">
              Click on each stem below to download the individual files:
            </p>
            <ul style="list-style-type: none; padding: 0;">
              ${stemLinks}
            </ul>
          </div>

          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #1976d2; margin-top: 0;">Important Notes</h3>
            <ul style="color: #666; margin: 0;">
              <li>These stems are for your personal use and music production</li>
              <li>Please respect the producer's copyright and licensing terms</li>
              <li>Download links will be available for 30 days</li>
              <li>For technical support, contact us at support@beatpackz.com</li>
            </ul>
          </div>

          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 14px;">
              This email was sent from BeatPackz<br>
              If you have any questions, please contact us at support@beatpackz.com
            </p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the stem email activity (optional - for tracking)
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: beat.profiles?.id || beat.producer_id,
        type: 'stem_delivery',
        title: 'Stems Delivered',
        message: `Stems for "${beat.title}" have been delivered to ${customerEmail}`,
        data: {
          beat_id: beatId,
          customer_email: customerEmail,
          stems_count: stems.length,
          purchase_id: purchaseId
        }
      });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Stems emailed successfully to ${customerEmail}`,
      stemsCount: stems.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-stems function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);