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
    const channel = supabase.channel(`radio-${sessionId}`);

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
  }, [sessionId]);

  const startBroadcast = useCallback(async () => {
    if (isBroadcasting) return;

    try {
      const channel = setupChannel();

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
      if (!presence) console.warn('Radio: presence tracking failed');

      if (!channelRef.current) {
        await new Promise<void>((resolve) => channel.subscribe((status) => status === 'SUBSCRIBED' && resolve()));
      } else if ((channelRef.current as any).state !== 'SUBSCRIBED') {
        await new Promise<void>((resolve) => channel.subscribe((status) => status === 'SUBSCRIBED' && resolve()));
      }

      // Get master session audio from HostMasterAudio
      const { HostMasterAudio } = await import('@/lib/HostMasterAudio');
      const hostMaster = HostMasterAudio.getInstance();
      if (!hostMaster.isInitialized) {
        await hostMaster.initialize();
        hostMaster.connectToCookModeEngine();
      }
      const sessionStream = hostMaster.getMasterStream();
      if (!sessionStream) {
        toast.error('No audio available. Start playback first.');
        return;
      }

      const context = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = context.createMediaStreamSource(sessionStream);
      const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = float32ToPCM16(input);
        const bytes = new Uint8Array(pcm16.buffer);
        const b64 = uint8ToBase64(bytes);
        const seq = ++seqRef.current;

        if (!announcedRef.current) {
          channel.send({
            type: 'broadcast',
            event: 'radio-start',
            payload: { sampleRate: SAMPLE_RATE, startedAt: Date.now() }
          });
          announcedRef.current = true;
        }

        channel.send({
          type: 'broadcast',
          event: 'radio-chunk',
          payload: { from: currentUserId, seq, audio: b64, sampleRate: SAMPLE_RATE, ts: Date.now() }
        });
      };

      source.connect(processor);
      processor.connect(context.destination);

      contextRef.current = context;
      sourceRef.current = source;
      processorRef.current = processor;
      setIsBroadcasting(true);
      toast.success('Broadcast started');
    } catch (e) {
      console.error('Radio start error', e);
      toast.error('Failed to start broadcast');
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