import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { float32ToPCM16, uint8ToBase64 } from '@/lib/radio/wav';

interface UseRadioBroadcastProps {
  sessionId: string;
  currentUserId?: string;
}

export const useRadioBroadcast = ({ sessionId, currentUserId }: UseRadioBroadcastProps) => {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [listenerCount, setListenerCount] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const seqRef = useRef<number>(0);
  const announcedRef = useRef<boolean>(false);

  const SAMPLE_RATE = 24000;
  const BUFFER_SIZE = 4096;

  const setupChannel = useCallback(() => {
    if (channelRef.current) return channelRef.current;
    const channel = supabase.channel(`radio-${sessionId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: currentUserId || 'host' },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const all = (Object.values(state).flat() as any[]);
        const viewers = all.filter((p: any) => p.role === 'viewer');
        setListenerCount(viewers.length);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setListenerCount((c) => c + newPresences.filter((p: any) => p.role === 'viewer').length);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setListenerCount((c) => Math.max(0, c - leftPresences.filter((p: any) => p.role === 'viewer').length));
      });

    channelRef.current = channel;
    return channel;
  }, [sessionId, currentUserId]);

  const startBroadcast = useCallback(async () => {
    if (isBroadcasting) return;

    try {
      console.log('[Radio] Starting broadcast...');
      const channel = setupChannel();

      // 1) Ensure we are SUBSCRIBED before doing anything else
      console.log('[Radio] Subscribing to channel...');
      await new Promise<void>((resolve) => {
        const unsub = channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Radio] Channel subscribed');
            resolve();
          }
        });
      });

      // 2) Track presence AFTER subscribe
      console.log('[Radio] Getting user and tracking presence...');
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('producer_name')
        .eq('id', user?.id)
        .single();

      const presence = await channel.track({
        user_id: user?.id,
        username: profile?.producer_name || 'Host',
        streaming: true,
        role: 'host'
      });
      if (!presence) console.warn('[Radio] Presence tracking failed');

      // 3) Get session master stream from CookMode engine
      console.log('[Radio] Getting HostMasterAudio...');
      const { HostMasterAudio } = await import('@/lib/HostMasterAudio');
      const hostMaster = HostMasterAudio.getInstance();
      console.log('[Radio] HostMaster initialized?', hostMaster.isInitialized);

      if (!hostMaster.isInitialized) {
        console.log('[Radio] Initializing HostMasterAudio...');
        await hostMaster.initialize();
        hostMaster.connectToCookModeEngine();
      }

      console.log('[Radio] Getting master stream...');
      const sessionStream = hostMaster.getMasterStream();
      console.log('[Radio] Got stream?', !!sessionStream, 'tracks:', sessionStream?.getTracks().length);

      let stream: MediaStream | null = sessionStream;
      if (!stream) {
        console.warn('[Radio] No CookMode stream. Falling back to microphone...');
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 24000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          toast.message('Broadcasting microphone audio');
        } catch (micErr) {
          console.error('[Radio] Mic fallback failed', micErr);
          toast.error('No audio available. Start session playback or allow mic.');
          return;
        }
      }

      // 4) Create AudioContext (let browser choose supported sample rate)
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const context: AudioContext = new AC();
      try {
        await context.resume();
      } catch (err) {
        console.warn('[Radio] AudioContext resume failed', err);
      }
      console.log('[Radio] AudioContext state:', context.state);
      const effectiveSampleRate = context.sampleRate;
      console.log('[Radio] AudioContext created. sampleRate=', effectiveSampleRate);

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);

      console.log('[Radio] Setting up audio processor...');
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = float32ToPCM16(input);
        const bytes = new Uint8Array(pcm16.buffer);
        const b64 = uint8ToBase64(bytes);
        const seq = ++seqRef.current;

        if (!announcedRef.current) {
          console.log('[Radio] Sending radio-start event');
          channel.send({
            type: 'broadcast',
            event: 'radio-start',
            payload: { sampleRate: effectiveSampleRate, startedAt: Date.now() }
          });
          announcedRef.current = true;
        }

        channel.send({
          type: 'broadcast',
          event: 'radio-chunk',
          payload: { from: currentUserId, seq, audio: b64, sampleRate: effectiveSampleRate, ts: Date.now() }
        });
      };

      source.connect(processor);
      // Keep processor running by connecting to destination (no audible output from processor itself)
      processor.connect(context.destination);

      contextRef.current = context;
      sourceRef.current = source;
      processorRef.current = processor;
      setIsBroadcasting(true);
      console.log('[Radio] ✅ Broadcast started successfully');
      toast.success('Broadcast started');
    } catch (e: any) {
      console.error('[Radio] ❌ Start error:', e);
      toast.error(`Failed to start broadcast: ${e?.message || e}`);
    }
  }, [isBroadcasting, setupChannel, currentUserId]);

  const stopBroadcast = useCallback(async () => {
    try {
      const channel = setupChannel();
      channel.send({ type: 'broadcast', event: 'radio-stop', payload: { at: Date.now() } });

      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      if (contextRef.current) await contextRef.current.close();

      processorRef.current = null;
      sourceRef.current = null;
      contextRef.current = null;
      seqRef.current = 0;
      announcedRef.current = false;

      if (channelRef.current) {
        channelRef.current.untrack();
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      setIsBroadcasting(false);
      toast.success('Broadcast stopped');
    } catch (e) {
      console.error('Radio stop error', e);
    }
  }, [setupChannel]);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      if (isBroadcasting) stopBroadcast();
    };
  }, [isBroadcasting, stopBroadcast]);

  return { isBroadcasting, listenerCount, startBroadcast, stopBroadcast };
};