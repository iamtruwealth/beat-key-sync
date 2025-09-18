import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authorization');
    }

    const { track_id, detected_bpm, detected_key, manual_bpm, manual_key } = await req.json();

    console.log('Learning from user corrections:', {
      track_id,
      detected_bpm,
      detected_key,
      manual_bpm,
      manual_key,
      user_id: user.id
    });

    // Store the correction data for future learning
    const correctionData = {
      track_id,
      user_id: user.id,
      detected_bpm,
      detected_key,
      manual_bpm,
      manual_key,
      correction_timestamp: new Date().toISOString()
    };

    // For now, we'll just log the correction data
    // In a production system, you would:
    // 1. Store this in a corrections table
    // 2. Use machine learning to improve detection algorithms
    // 3. Analyze patterns in corrections to retrain models

    console.log('Correction data logged for future learning:', correctionData);

    // You could also implement immediate feedback by:
    // 1. Updating confidence scores for similar tracks
    // 2. Adjusting BPM/key detection parameters
    // 3. Creating user-specific adjustment factors

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Correction logged for learning',
        correction_data: correctionData 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in learn-from-corrections function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});