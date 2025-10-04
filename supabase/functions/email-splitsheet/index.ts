import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailSplitSheetRequest {
  splitSheetId: string;
  recipients: string[];
  pdfData: string; // Base64 encoded PDF
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { splitSheetId, recipients, pdfData }: EmailSplitSheetRequest = await req.json();

    // Validate inputs
    if (!splitSheetId || !recipients || !pdfData) {
      throw new Error("Missing required fields");
    }

    if (recipients.length === 0) {
      throw new Error("At least one recipient is required");
    }

    console.log(`Sending split sheet ${splitSheetId} to ${recipients.length} recipients`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get split sheet details
    const { data: splitSheet, error: fetchError } = await supabase
      .from('split_sheets')
      .select(`
        *,
        split_sheet_contributors (*)
      `)
      .eq('id', splitSheetId)
      .single();

    if (fetchError || !splitSheet) {
      throw new Error("Split sheet not found");
    }

    // Convert base64 to buffer
    const pdfBuffer = Uint8Array.from(atob(pdfData), c => c.charCodeAt(0));

    // Send emails to all recipients
    const emailPromises = recipients.map(async (email) => {
      return await resend.emails.send({
        from: "BeatPackz <onboarding@resend.dev>",
        to: [email],
        subject: `Split Sheet: ${splitSheet.song_title}`,
        html: `
          <h2>Split Sheet for "${splitSheet.song_title}"</h2>
          <p>Please find attached the split sheet agreement for the song "${splitSheet.song_title}".</p>
          
          <h3>Song Details:</h3>
          <ul>
            <li><strong>Artist:</strong> ${splitSheet.artist_name}</li>
            <li><strong>Producer:</strong> ${splitSheet.producer_name}</li>
            <li><strong>Date:</strong> ${new Date(splitSheet.date_of_agreement).toLocaleDateString()}</li>
          </ul>
          
          <h3>Contributors:</h3>
          <table style="border-collapse: collapse; width: 100%; margin-top: 10px;">
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Name</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Role</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ownership %</th>
            </tr>
            ${splitSheet.split_sheet_contributors.map((c: any) => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${c.name}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${c.role}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${c.ownership_percentage}%</td>
              </tr>
            `).join('')}
          </table>
          
          <p style="margin-top: 20px;">Please review the attached PDF for the complete split sheet agreement.</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated email from BeatPackz. Please do not reply to this email.
          </p>
        `,
        attachments: [
          {
            filename: `${splitSheet.song_title.replace(/[^a-z0-9]/gi, '_')}_split_sheet.pdf`,
            content: pdfBuffer,
          },
        ],
      });
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => !r.error).length;
    
    console.log(`Successfully sent ${successCount}/${recipients.length} emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount,
        total: recipients.length 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in email-splitsheet function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);