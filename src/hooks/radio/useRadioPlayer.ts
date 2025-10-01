import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { base64ToUint8 } from '@/lib/radio/wav';
import { AudioQueue } from '@/lib/radio/AudioQueue';

interface UseRadioPlayerProps {
  sessionId: string;
}

export const useRadioPlayer = ({ sessionId }: UseRadioPlayerProps) => {
  const [isListening, setIsListening] = useState(false);
  const [hostOnline, setHostOnline] = useState(false);
  const [listeners, setListeners] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioQueue | null>(null);
  const lastSeqRef = useRef<number>(0);
  const presenceKeyRef = useRef<string>(`viewer-${Math.random().toString(36).slice(2)}`);

  const setupChannel = useCallback(() => {
    if (channelRef.current) return channelRef.current;
    const channel = supabase.channel(`radio-${sessionId}`, { config: { broadcast: { self: true }, presence: { key: presenceKeyRef.current } } });

    channel
      .on('broadcast', { event: 'radio-start' }, ({ payload }) => {
        console.log('Radio: start', payload);
        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        if (!queueRef.current) queueRef.current = new AudioQueue(audioContextRef.current);
        setHostOnline(true);
      })
      .on('broadcast', { event: 'radio-chunk' }, async ({ payload }) => {
        try {
          const { audio, seq, sampleRate } = payload;
          if (!audioContextRef.current) audioContextRef.current = new AudioContext();
          if (!queueRef.current) queueRef.current = new AudioQueue(audioContextRef.current);

          // simple out-of-order protection
          if (typeof seq === 'number' && seq <= lastSeqRef.current) return;
          lastSeqRef.current = seq || lastSeqRef.current;

          const bytes = base64ToUint8(audio);
          await queueRef.current.addToQueue(bytes, sampleRate || 24000);
        } catch (err) {
          console.error('Radio: chunk error', err);
        }
      })
      .on('broadcast', { event: 'radio-stop' }, () => {
        queueRef.current?.clear();
        setHostOnline(false);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const all = (Object.values(state).flat() as any[]);
        const viewers = all.filter((p: any) => p.role === 'viewer');
        const host = all.find((p: any) => p.role === 'host' && p.streaming === true);
        setListeners(viewers.length);
        setHostOnline(!!host);
      });

    channelRef.current = channel;
    return channel;
  }, [sessionId]);

  const startListening = useCallback(async () => {
    try {
      const channel = setupChannel();
      if (!channelRef.current) {
        await new Promise<void>((resolve) => channel.subscribe((status) => status === 'SUBSCRIBED' && resolve()));
      } else if ((channelRef.current as any).state !== 'SUBSCRIBED') {
        await new Promise<void>((resolve) => channel.subscribe((status) => status === 'SUBSCRIBED' && resolve()));
      }

      const { data: { user } } = await supabase.auth.getUser();
      await channel.track({ user_id: user?.id, username: 'Listener', role: 'viewer', streaming: false });

      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      await audioContextRef.current.resume();
      if (!queueRef.current) queueRef.current = new AudioQueue(audioContextRef.current);

      setIsListening(true);
      toast.message('Joined radio stream');
    } catch (e) {
      console.error('Radio: listen error', e);
      toast.error('Failed to join stream');
    }
  }, [setupChannel]);

  const stopListening = useCallback(async () => {
    try {
      queueRef.current?.clear();
      if (channelRef.current) {
        channelRef.current.untrack();
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setIsListening(false);
      toast.message('Left radio stream');
    } catch (e) {
      console.error('Radio: stop listen error', e);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (isListening) stopListening();
    };
  }, [isListening, stopListening]);

  return { isListening, hostOnline, listeners, startListening, stopListening };
};