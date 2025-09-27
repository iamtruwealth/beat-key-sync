import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { sessionId, published, savedBy } = await req.json()

    console.log(`Processing session save notification for session: ${sessionId}`)

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('collaboration_projects')
      .select('name, created_by')
      .eq('id', sessionId)
      .single()

    if (sessionError) {
      console.error('Error fetching session:', sessionError)
      throw sessionError
    }

    // Get the user who saved the session
    const { data: saver, error: saverError } = await supabase
      .from('profiles')
      .select('producer_name')
      .eq('id', savedBy)
      .single()

    if (saverError) {
      console.error('Error fetching saver profile:', saverError)
    }

    // Get all collaboration members except the person who saved
    const { data: members, error: membersError } = await supabase
      .from('collaboration_members')
      .select('user_id')
      .eq('collaboration_id', sessionId)
      .eq('status', 'accepted')
      .neq('user_id', savedBy)

    if (membersError) {
      console.error('Error fetching collaboration members:', membersError)
      throw membersError
    }

    const saverName = saver?.producer_name || 'A collaborator'
    const action = published ? 'published' : 'saved'
    const message = `${saverName} has ${action} the Cook Mode session "${session.name}". ${published ? 'The session is now ready for final review and distribution.' : 'You can continue working on it anytime.'}`

    // Create notifications for all members
    const notifications = members.map(member => ({
      user_id: member.user_id,
      type: published ? 'session_published' : 'session_saved',
      title: `Session ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: message,
      item_id: sessionId,
      actor_id: savedBy
    }))

    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notifications)

      if (notificationError) {
        console.error('Error creating notifications:', notificationError)
        throw notificationError
      }

      console.log(`Created ${notifications.length} notifications for session save`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsCreated: notifications.length,
        action: action
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in notify-session-save function:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})