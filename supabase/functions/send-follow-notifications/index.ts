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

    const { type, itemId, producerId, title } = await req.json();

    console.log(`Sending notifications for ${type}: ${itemId} by producer ${producerId}`);

    // Get all followers of the producer
    const { data: followers, error: followersError } = await supabaseClient
      .from('follows')
      .select('follower_id, profiles!follows_follower_id_fkey(producer_name)')
      .eq('followed_id', producerId);

    if (followersError) {
      console.error('Error fetching followers:', followersError);
      throw followersError;
    }

    if (!followers || followers.length === 0) {
      console.log('No followers to notify');
      return new Response(
        JSON.stringify({ success: true, message: 'No followers to notify' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get producer name
    const { data: producerData } = await supabaseClient
      .from('profiles')
      .select('producer_name')
      .eq('id', producerId)
      .single();

    const producerName = producerData?.producer_name || 'A producer';

    // Create notifications for all followers
    const notifications = followers.map(follower => ({
      user_id: follower.follower_id,
      type: type,
      message: `${producerName} just uploaded a new ${type === 'beat_pack' ? 'beat pack' : type}: ${title}`,
      item_id: itemId,
      actor_id: producerId,
      title: 'New Content'
    }));

    const { error: insertError } = await supabaseClient
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error creating notifications:', insertError);
      throw insertError;
    }

    console.log(`Successfully sent ${notifications.length} notifications`);

    return new Response(
      JSON.stringify({ success: true, notificationCount: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in send-follow-notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});