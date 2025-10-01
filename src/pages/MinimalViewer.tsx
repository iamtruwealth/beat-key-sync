import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import * as Tone from 'tone';

const DEFAULT_SESSION = '7ec9d14d-82bf-4be8-91aa-a391815a1a72';

export default function MinimalViewer() {
  const { sessionId = DEFAULT_SESSION } = useParams<{ sessionId: string }>();
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [streamCount, setStreamCount] = useState(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [currentUserId] = useState(`viewer-${Math.random().toString(36).substr(2, 9)}`);
  const currentStreamIdRef = useRef<string | null>(null);

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] ${message}`;
    console.log(logLine);
    setLogs(prev => [...prev.slice(-20), logLine]);
  };

  const enableAudio = async () => {
    log('🔊 Enabling audio context...');
    try {
      await Tone.start();
      const ctx = Tone.getContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      log(`✅ Audio enabled, state: ${ctx.state}`);
      setAudioEnabled(true);
      // Immediately setup viewer after enabling audio
      await setupViewer();
    } catch (err) {
      log(`❌ Audio enable failed: ${err}`);
    }
  };

  const setupViewer = async () => {
    log(`🎬 Setting up viewer for session: ${sessionId}`);
    
    // Setup Supabase channel - MUST match host's channel name
    const channel = supabase.channel(`audio-only-${sessionId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'audio-offer' }, async ({ payload }) => {
        log(`📥 Received audio offer from: ${payload.from}`);
        if (payload.from !== currentUserId) {
          await handleOffer(payload.from, payload.offer);
        }
      })
      .on('broadcast', { event: 'audio-answer' }, async ({ payload }) => {
        log(`📥 Received audio answer from: ${payload.from}`);
        if (payload.from !== currentUserId) {
          await handleAnswer(payload.answer);
        }
      })
      .on('broadcast', { event: 'audio-ice-candidate' }, async ({ payload }) => {
        log(`📥 Received ICE candidate from: ${payload.from}`);
        if (payload.from !== currentUserId) {
          await handleIceCandidate(payload.candidate);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        log(`👥 Presence sync: ${count} users`);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: any) => {
          log(`✅ User joined: ${p.username || p.user_id}`);
        });
      });

    await channel.subscribe();
    log('✅ Subscribed to audio-only channel');

    // Track presence as viewer
    const { data: { user } } = await supabase.auth.getUser();
    await channel.track({
      user_id: user?.id || `viewer-${Date.now()}`,
      username: 'Minimal Test Viewer',
      role: 'viewer',
      online_at: new Date().toISOString()
    });
    log('✅ Presence tracked as viewer');

    setIsConnected(true);
  };

  const handleOffer = async (fromUserId: string, offer: RTCSessionDescriptionInit) => {
    log('🔄 Creating peer connection...');
    
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'audio-ice',
        payload: {
          from: 'viewer',
          to: fromUserId,
          candidate: event.candidate
        }
      });
    }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      log(`🎵 Received track! Stream ID: ${stream.id}, Active: ${stream.active}`);
      log(`   Audio tracks: ${stream.getAudioTracks().length}`);
      log(`   Video tracks: ${stream.getVideoTracks().length}`);
      
      // Check if this is a duplicate stream
      if (currentStreamIdRef.current === stream.id && audioElementRef.current?.srcObject) {
        log('⚠️ Duplicate stream detected, skipping');
        return;
      }

      setStreamCount(prev => prev + 1);
      playAudioStream(stream);
    };

    pc.onconnectionstatechange = () => {
      log(`🔗 Connection state: ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      log(`❄️ ICE state: ${pc.iceConnectionState}`);
    };

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'audio-answer',
        payload: {
          from: currentUserId,
          to: fromUserId,
          answer
        }
      });
      log('📤 Sent audio answer');
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(answer);
      log('✅ Set remote description from answer');
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(candidate);
      log('✅ Added ICE candidate');
    }
  };

  const playAudioStream = (stream: MediaStream) => {
    log('🔊 Attempting to play audio stream...');

    // Reuse or create audio element
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio();
      audioElementRef.current.autoplay = true;
      // @ts-ignore
      audioElementRef.current.playsInline = true;
      log('📱 Created new audio element');
    }

    audioElementRef.current.srcObject = stream;
    currentStreamIdRef.current = stream.id;

    audioElementRef.current.play()
      .then(() => {
        log('✅ Audio playback started successfully!');
      })
      .catch((err) => {
        log(`❌ Playback failed: ${err.message}`);
      });
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-neon-cyan to-electric-blue bg-clip-text text-transparent">
            Minimal Audio Viewer Test
          </h1>
          <p className="text-muted-foreground">
            Session: {sessionId}
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Status</h2>
              <div className="flex gap-2">
                <Badge variant={audioEnabled ? "default" : "outline"}>
                  Audio: {audioEnabled ? "Enabled" : "Disabled"}
                </Badge>
                <Badge variant={isConnected ? "default" : "outline"}>
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
                <Badge variant={streamCount > 0 ? "default" : "outline"}>
                  Streams: {streamCount}
                </Badge>
              </div>
            </div>
            
            {!audioEnabled && (
              <Button 
                onClick={enableAudio}
                className="bg-gradient-to-r from-green-500 to-emerald-500"
                size="lg"
              >
                🔊 Enable Audio & Connect
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
          <div className="bg-black/50 rounded p-4 h-96 overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">No logs yet...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-green-400">{log}</div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 bg-card/50">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Click "Enable Audio & Connect" above</li>
            <li>Make sure the host is streaming at: /cook-mode/{sessionId}</li>
            <li>Watch the logs below for WebRTC connection status</li>
            <li>Listen for audio glitches or duplicates</li>
            <li>Check the "Streams" counter - should stay at 1</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
