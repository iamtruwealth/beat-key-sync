import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * HLS Audio Streaming Edge Function
 * 
 * This function handles WebSocket connections from CookMode hosts and
 * prepares audio chunks for HLS encoding via FFmpeg.
 * 
 * DEPLOYMENT REQUIREMENTS:
 * 1. FFmpeg must be available in the runtime (custom Deno Deploy or Docker)
 * 2. Storage bucket 'hls-streams' must exist in Supabase Storage
 * 3. CORS and WebSocket support configured
 * 
 * ARCHITECTURE:
 * - Receives WebSocket audio chunks (WebM/Opus format)
 * - Pipes to FFmpeg for HLS transcoding
 * - Outputs .m3u8 playlist + .ts segments to Storage
 * - Viewers load HLS stream from Storage
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
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

    // Upgrade to WebSocket
    const upgrade = req.headers.get('upgrade') || '';
    if (upgrade.toLowerCase() !== 'websocket') {
      return new Response(
        JSON.stringify({ error: 'WebSocket upgrade required' }),
        { status: 426, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    // Handle WebSocket connection
    socket.onopen = () => {
      console.log(`[Stream] WebSocket opened for session: ${sessionId}`);
    };

    socket.onmessage = async (event) => {
      try {
        // Receive audio chunk (ArrayBuffer)
        const audioChunk = event.data;
        
        if (!(audioChunk instanceof ArrayBuffer)) {
          console.warn('[Stream] Received non-binary data, skipping');
          return;
        }

        console.log(`[Stream] Received chunk: ${audioChunk.byteLength} bytes`);

        // TODO: Pipe to FFmpeg for HLS encoding
        // This is a placeholder - actual implementation requires:
        // 1. FFmpeg subprocess spawning
        // 2. Piping audio data to FFmpeg stdin
        // 3. FFmpeg HLS output configuration
        // 4. Uploading .m3u8 and .ts segments to Supabase Storage
        
        // Example FFmpeg command (would need to be adapted for Deno):
        // ffmpeg -f webm -i pipe:0 -c:a aac -b:a 128k -f hls \
        //   -hls_time 2 -hls_list_size 5 -hls_flags delete_segments \
        //   /tmp/stream/${sessionId}/out.m3u8

        // For now, log that we're receiving data
        // Production implementation would require custom Deno runtime with FFmpeg
        
      } catch (error) {
        console.error('[Stream] Error processing chunk:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('[Stream] WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log(`[Stream] WebSocket closed for session: ${sessionId}`);
      // TODO: Clean up FFmpeg process and temp files
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

/* 
 * PRODUCTION DEPLOYMENT GUIDE:
 * 
 * Option 1: Docker Container (Recommended)
 * ==========================================
 * Deploy this as a containerized service with FFmpeg:
 * 
 * Dockerfile:
 * ```
 * FROM denoland/deno:latest
 * RUN apt-get update && apt-get install -y ffmpeg
 * WORKDIR /app
 * COPY . .
 * EXPOSE 8000
 * CMD ["deno", "run", "--allow-all", "index.ts"]
 * ```
 * 
 * Deploy to: Railway, Fly.io, or any Docker host
 * 
 * 
 * Option 2: Node.js + FFmpeg Server
 * ====================================
 * Alternative implementation using Node.js:
 * 
 * ```javascript
 * const WebSocket = require('ws');
 * const { spawn } = require('child_process');
 * const { createClient } = require('@supabase/supabase-js');
 * 
 * const wss = new WebSocket.Server({ port: 8080 });
 * const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
 * 
 * wss.on('connection', (ws, req) => {
 *   const sessionId = new URL(req.url, 'http://localhost').searchParams.get('session');
 *   
 *   // Spawn FFmpeg for HLS encoding
 *   const ffmpeg = spawn('ffmpeg', [
 *     '-f', 'webm',
 *     '-i', 'pipe:0',
 *     '-c:a', 'aac',
 *     '-b:a', '128k',
 *     '-f', 'hls',
 *     '-hls_time', '2',
 *     '-hls_list_size', '5',
 *     '-hls_flags', 'delete_segments',
 *     '-hls_segment_filename', `/tmp/${sessionId}/segment_%03d.ts`,
 *     `/tmp/${sessionId}/out.m3u8`
 *   ]);
 * 
 *   ws.on('message', (data) => {
 *     // Pipe audio to FFmpeg
 *     ffmpeg.stdin.write(data);
 *   });
 * 
 *   ws.on('close', () => {
 *     ffmpeg.stdin.end();
 *     ffmpeg.kill('SIGINT');
 *     // Upload to Supabase Storage
 *   });
 * });
 * ```
 * 
 * 
 * Option 3: Supabase Storage + CDN
 * ==================================
 * 1. Create 'hls-streams' bucket in Supabase Storage
 * 2. Set public bucket policy for viewer access
 * 3. FFmpeg writes directly to mounted storage or uploads via SDK
 * 4. Viewers load HLS from: {SUPABASE_URL}/storage/v1/object/public/hls-streams/{sessionId}/out.m3u8
 * 
 * 
 * SCALING CONSIDERATIONS:
 * ========================
 * - One FFmpeg process per active streaming session
 * - Use session ID to isolate streams
 * - Auto-cleanup old segments (FFmpeg delete_segments flag)
 * - Monitor memory/CPU per concurrent stream
 * - Consider using adaptive bitrate (HLS variants) for large audiences
 */
