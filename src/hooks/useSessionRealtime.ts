import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeParticipant {
  user_id: string;
  username: string;
  joined_at: string;
  presence_ref: string;
}

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  bpm: number;
  key: string;
}

export const useSessionRealtime = (sessionId: string | null) => {
  const [participants, setParticipants] = useState<RealtimeParticipant[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    bpm: 140,
    key: 'C'
  });
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    console.log('🔄 Setting up real-time channel for session:', sessionId);

    // Create channel for this session
    const sessionChannel = supabase.channel(`cook-mode-${sessionId}`, {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    // Track user presence
    sessionChannel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = sessionChannel.presenceState();
        console.log('👥 Presence sync:', presenceState);
        
        const allParticipants: RealtimeParticipant[] = [];
        Object.keys(presenceState).forEach(key => {
          const presences = presenceState[key] as any[];
          presences.forEach(presence => {
            allParticipants.push({
              user_id: presence.user_id,
              username: presence.username,
              joined_at: presence.joined_at,
              presence_ref: presence.presence_ref
            });
          });
        });
        
        setParticipants(allParticipants);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('✅ User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('❌ User left:', leftPresences);
      })
      // Listen for playback events
      .on('broadcast', { event: 'playback-toggle' }, ({ payload }) => {
        console.log('🎵 Playback toggled:', payload);
        setPlaybackState(prev => ({ ...prev, isPlaying: payload.isPlaying }));
      })
      .on('broadcast', { event: 'playback-seek' }, ({ payload }) => {
        console.log('⏱️ Playback seek:', payload);
        setPlaybackState(prev => ({ ...prev, currentTime: payload.currentTime }));
      })
      .on('broadcast', { event: 'session-settings' }, ({ payload }) => {
        console.log('⚙️ Session settings updated:', payload);
        setPlaybackState(prev => ({ ...prev, bpm: payload.bpm, key: payload.key }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🔗 Connected to real-time session');
          
          // Get current user info
          const { data: { user } } = await supabase.auth.getUser();
          const { data: profile } = await supabase
            .from('profiles')
            .select('producer_name, first_name, last_name')
            .eq('id', user?.id)
            .single();

          const username = profile?.producer_name || 
                          `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                          'Anonymous';

          // Track presence
          await sessionChannel.track({
            user_id: user?.id,
            username,
            joined_at: new Date().toISOString(),
          });
        }
      });

    setChannel(sessionChannel);

    return () => {
      console.log('🔌 Disconnecting from real-time session');
      sessionChannel.unsubscribe();
    };
  }, [sessionId]);

  // Broadcast functions - only allow if user has edit permissions
  const broadcastPlaybackToggle = (isPlaying: boolean, canEdit: boolean = true) => {
    if (channel && canEdit) {
      channel.send({
        type: 'broadcast',
        event: 'playback-toggle',
        payload: { isPlaying }
      });
    }
  };

  const broadcastPlaybackSeek = (currentTime: number, canEdit: boolean = true) => {
    if (channel && canEdit) {
      channel.send({
        type: 'broadcast',
        event: 'playback-seek',
        payload: { currentTime }
      });
    }
  };

  const broadcastSessionSettings = (bpm: number, key: string, canEdit: boolean = true) => {
    if (channel && canEdit) {
      channel.send({
        type: 'broadcast',
        event: 'session-settings',
        payload: { bpm, key }
      });
    }
  };

  return {
    participants,
    playbackState,
    broadcastPlaybackToggle,
    broadcastPlaybackSeek,
    broadcastSessionSettings,
    isConnected: !!channel
  };
};