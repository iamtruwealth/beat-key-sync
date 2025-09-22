import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { type, itemId, itemType, actorId, targetUserId } = await req.json();

    console.log(`Sending ${type} notification for ${itemType}: ${itemId}`);

    // Don't notify users about their own actions
    if (actorId === targetUserId) {
      return new Response(
        JSON.stringify({ success: true, message: 'No self-notification needed' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get actor name
    const { data: actorData } = await supabaseClient
      .from('profiles')
      .select('producer_name')
      .eq('id', actorId)
      .single();

    const actorName = actorData?.producer_name || 'Someone';

    let message = '';
    let notificationType = type;

    switch (type) {
      case 'like':
        message = `${actorName} liked your ${itemType}`;
        break;
      case 'comment':
        message = `${actorName} commented on your ${itemType}`;
        break;
      case 'follow':
        message = `${actorName} started following you`;
        notificationType = 'follow';
        break;
      default:
        message = `${actorName} interacted with your ${itemType}`;
    }

    // Create notification
    const { error: insertError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: targetUserId,
        type: notificationType,
        message: message,
        item_id: itemId,
        actor_id: actorId,
        title: 'New Interaction'
      });

    if (insertError) {
      console.error('Error creating notification:', insertError);
      throw insertError;
    }

    console.log(`Successfully sent ${type} notification`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in send-interaction-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});