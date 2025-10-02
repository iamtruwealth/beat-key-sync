# HLS Audio Streaming Deployment Guide

This guide explains how to deploy the HLS audio streaming infrastructure for CookMode live sessions.

## Architecture Overview

```
Host Browser (CookMode)
    ↓ MediaRecorder (WebM/Opus)
    ↓ WebSocket
Streaming Server (Node.js/Deno + FFmpeg)
    ↓ HLS Encoding (.m3u8 + .ts segments)
    ↓ Upload/Mount
Supabase Storage (or CDN)
    ↓ HTTP(S)
Viewer Browser (HLS.js)
```

## Deployment Options

### Option 1: Docker Container (Recommended)

**Best for**: Easy deployment on any cloud platform (Railway, Fly.io, AWS ECS, etc.)

#### 1. Create Dockerfile

```dockerfile
FROM denoland.deno:latest

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy edge function
COPY supabase/functions/stream-audio/index.ts .

# Expose port
EXPOSE 8000

# Run server
CMD ["deno", "run", "--allow-all", "index.ts"]
```

#### 2. Build and Deploy

```bash
# Build
docker build -t cookmode-streaming .

# Run locally for testing
docker run -p 8000:8000 \
  -e SUPABASE_URL=your_url \
  -e SUPABASE_ANON_KEY=your_key \
  cookmode-streaming

# Deploy to Railway
railway up

# Or deploy to Fly.io
fly deploy
```

### Option 2: Node.js + FFmpeg Server

**Best for**: Custom server setup, full control

#### 1. Create Node.js Server

```javascript
// server.js
const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const wss = new WebSocket.Server({ port: 8080 });
const activeSessions = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('session');
  
  if (!sessionId) {
    ws.close(1008, 'Session ID required');
    return;
  }

  console.log(`[Stream] New connection for session: ${sessionId}`);
  
  // Create temp directory for HLS output
  const streamDir = path.join('/tmp', 'streams', sessionId);
  fs.mkdirSync(streamDir, { recursive: true });

  // Spawn FFmpeg process
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'webm',
    '-i', 'pipe:0',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '5',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(streamDir, 'segment_%03d.ts'),
    path.join(streamDir, 'out.m3u8')
  ]);

  // Store FFmpeg process
  activeSessions.set(sessionId, { ws, ffmpeg, streamDir });

  ffmpeg.stdout.on('data', (data) => {
    console.log(`[FFmpeg ${sessionId}] ${data}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[FFmpeg ${sessionId}] ${data}`);
  });

  ffmpeg.on('close', (code) => {
    console.log(`[FFmpeg ${sessionId}] Process exited with code ${code}`);
  });

  // Receive audio chunks from browser
  ws.on('message', (data) => {
    if (ffmpeg.stdin.writable) {
      ffmpeg.stdin.write(data);
    }
  });

  // Handle disconnection
  ws.on('close', async () => {
    console.log(`[Stream] Connection closed for session: ${sessionId}`);
    
    // Stop FFmpeg gracefully
    ffmpeg.stdin.end();
    setTimeout(() => ffmpeg.kill('SIGINT'), 1000);

    // Upload final HLS files to Supabase Storage
    await uploadToStorage(sessionId, streamDir);

    // Cleanup
    activeSessions.delete(sessionId);
    fs.rmSync(streamDir, { recursive: true, force: true });
  });
});

async function uploadToStorage(sessionId, streamDir) {
  try {
    console.log(`[Storage] Uploading HLS files for session: ${sessionId}`);
    
    const files = fs.readdirSync(streamDir);
    
    for (const file of files) {
      const filePath = path.join(streamDir, file);
      const fileBuffer = fs.readFileSync(filePath);
      
      await supabase.storage
        .from('hls-streams')
        .upload(`${sessionId}/${file}`, fileBuffer, {
          contentType: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
          upsert: true
        });
    }
    
    console.log(`[Storage] Upload complete for session: ${sessionId}`);
  } catch (error) {
    console.error('[Storage] Upload error:', error);
  }
}

console.log('Streaming server running on ws://localhost:8080');
```

#### 2. Install Dependencies

```bash
npm install ws @supabase/supabase-js
```

#### 3. Run Server

```bash
# Install FFmpeg (Ubuntu/Debian)
sudo apt-get install ffmpeg

# Run server
SUPABASE_URL=your_url SUPABASE_ANON_KEY=your_key node server.js
```

### Option 3: Supabase Storage Setup

#### 1. Create Storage Bucket

```sql
-- In Supabase SQL Editor
insert into storage.buckets (id, name, public)
values ('hls-streams', 'hls-streams', true);
```

#### 2. Set Bucket Policy

```sql
-- Allow public read access
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'hls-streams' );
```

## Frontend Integration

### Update CookMode.tsx

Replace `useWebRTCAudioStream` with `useHLSAudioStream`:

```typescript
import { useHLSAudioStream } from '@/hooks/useHLSAudioStream';

// In CookMode component
const audioStream = useHLSAudioStream({
  sessionId: sessionId || '',
  isHost,
  enabled: true
});
```

### Update GhostViewer.tsx

Replace `AudioStreamViewer` with `HLSAudioViewer`:

```typescript
import { HLSAudioViewer } from '@/components/cookmode/HLSAudioViewer';

// In render
<HLSAudioViewer sessionId={sessionId} autoStart />
```

## Environment Variables

Add to your `.env` file:

```bash
# Streaming server URL (if using custom server)
VITE_STREAMING_SERVER_URL=wss://your-streaming-server.com

# Or if using Supabase Edge Function
VITE_SUPABASE_URL=https://your-project.supabase.co
```

## Testing Locally

### 1. Start Streaming Server

```bash
# Docker
docker run -p 8080:8080 cookmode-streaming

# Or Node.js
node server.js
```

### 2. Update Frontend URL

In `src/hooks/useHLSAudioStream.ts`, update `getStreamUrl()`:

```typescript
const getStreamUrl = () => {
  return 'ws://localhost:8080?session=' + sessionId;
};
```

### 3. Test End-to-End

1. Open CookMode as host
2. Start streaming (should connect to ws://localhost:8080)
3. Open GhostViewer in another browser/tab
4. Should see HLS player loading stream

## Production Checklist

- [ ] FFmpeg installed on server
- [ ] Supabase Storage bucket created (`hls-streams`)
- [ ] Storage bucket set to public
- [ ] WebSocket server deployed and accessible
- [ ] CORS headers configured
- [ ] SSL/TLS certificates for WSS (wss://)
- [ ] Environment variables set
- [ ] HLS.js added to dependencies (`npm install hls.js`)
- [ ] Test stream from host to viewer
- [ ] Monitor server CPU/memory usage
- [ ] Set up auto-cleanup for old HLS segments

## Scaling Considerations

### Resource Limits
- **1 stream**: ~50-100 MB RAM, minimal CPU
- **10 streams**: ~500 MB - 1 GB RAM, moderate CPU
- **100 streams**: Consider horizontal scaling (multiple servers)

### Optimization Tips
1. Use adaptive bitrate (HLS variants) for bandwidth efficiency
2. Implement session timeout (auto-kill inactive FFmpeg processes)
3. Use CDN for HLS delivery (CloudFlare, AWS CloudFront)
4. Monitor and limit concurrent streams per server
5. Use Redis for session state across multiple servers

## Troubleshooting

### "WebSocket connection failed"
- Check streaming server is running
- Verify WebSocket URL is correct
- Ensure CORS headers allow origin

### "HLS.js failed to load stream"
- Verify FFmpeg is running and producing .m3u8
- Check Supabase Storage has .m3u8 and .ts files
- Ensure Storage bucket is public
- Check browser console for network errors

### "No audio in viewer"
- Verify host is actually streaming (check browser console)
- Check FFmpeg logs for encoding errors
- Ensure viewer has auto-play permissions
- Try manually clicking play button

### "High latency/buffering"
- Reduce HLS segment duration (`-hls_time 1`)
- Reduce buffer sizes in HLS.js config
- Use lower audio bitrate if needed
- Check network bandwidth

## Support

For issues or questions:
1. Check browser console logs (`[HLS Stream]` prefix)
2. Check server logs (FFmpeg output)
3. Verify Supabase Storage contains HLS files
4. Test with VLC or other HLS player to isolate issues
