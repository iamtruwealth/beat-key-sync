import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session');

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upgrade = req.headers.get('upgrade') || '';
    if (upgrade.toLowerCase() !== 'websocket') {
      return new Response(
        JSON.stringify({ error: 'WebSocket upgrade required' }),
        { status: 426, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      console.log(`[Stream] WebSocket opened for session: ${sessionId}`);
      socket.send(JSON.stringify({ type: 'ready', sessionId }));
    };

    socket.onmessage = async (event) => {
      try {
        const audioChunk = event.data;
        
        if (!(audioChunk instanceof ArrayBuffer)) {
          console.warn('[Stream] Received non-binary data, skipping');
          return;
        }

        console.log(`[Stream] Received chunk: ${audioChunk.byteLength} bytes`);
        
        // Echo back for now (viewers can receive this via broadcast)
        // In production, this would pipe to FFmpeg for HLS encoding
        socket.send(audioChunk);
        
      } catch (error) {
        console.error('[Stream] Error processing chunk:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('[Stream] WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log(`[Stream] WebSocket closed for session: ${sessionId}`);
    };

    return response;

  } catch (error) {
    console.error('[Stream] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
