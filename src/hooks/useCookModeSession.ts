import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface Track {
  id: string;
  name: string;
  file_url: string;
  stem_type: string;
  uploaded_by: string;
  version_number: number;
  duration?: number;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  waveformData?: number[];
}

interface Participant {
  id: string;
  user_id: string;
  profile?: {
    producer_name?: string;
    producer_logo_url?: string;
  };
  role: string;
  joined_at: string;
}

interface Session {
  id: string;
  name: string;
  target_bpm?: number;
  target_genre?: string;
  created_by: string;
  status: string;
  workspace_type: string;
}

interface CreateSessionData {
  name: string;
  bpm: number;
  key: string;
  workspace_type: string;
}

export function useCookModeSession(sessionId?: string) {
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);
  const { toast } = useToast();

  // Real-time subscription for session updates
  useEffect(() => {
    if (!sessionId) return;

    const setupRealtime = async () => {
      try {
        // Join realtime channel for this session
        const channel = supabase.channel(`cook-mode-${sessionId}`)
          .on('presence', { event: 'sync' }, () => {
            const newState = channel.presenceState();
            const participantList: Participant[] = [];
            Object.values(newState).forEach((presences: any) => {
              presences.forEach((presence: any) => {
                participantList.push({
                  id: presence.presence_ref || presence.user_id,
                  user_id: presence.user_id,
                  role: presence.role || 'collaborator',
                  joined_at: presence.joined_at || new Date().toISOString()
                });
              });
            });
            setParticipants(participantList);
          })
          .on('presence', { event: 'join' }, ({ newPresences }) => {
            console.log('User joined:', newPresences);
          })
          .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            console.log('User left:', leftPresences);
          })
          .on('broadcast', { event: 'playback-control' }, ({ payload }) => {
            setIsPlaying(payload.isPlaying);
            setCurrentTime(payload.currentTime);
          })
          .on('broadcast', { event: 'seek' }, ({ payload }) => {
            setCurrentTime(payload.currentTime);
          })
          .on('broadcast', { event: 'track-added' }, ({ payload }) => {
            setTracks(prev => [...prev, payload.track]);
          })
          .on('broadcast', { event: 'track-updated' }, ({ payload }) => {
            setTracks(prev => prev.map(track => 
              track.id === payload.trackId ? { ...track, ...payload.updates } : track
            ));
          })
          .on('broadcast', { event: 'track-removed' }, ({ payload }) => {
            setTracks(prev => prev.filter(track => track.id !== payload.trackId));
          })
          .on('broadcast', { event: 'session-settings-updated' }, ({ payload }) => {
            setSession(prev => prev ? {
              ...prev,
              ...(payload.bpm && { target_bpm: payload.bpm }),
              ...(payload.key && { target_genre: payload.key })
            } : null);
          });

        await channel.subscribe();
        setIsConnected(true);
        channelRef.current = channel;
        
        // Track user presence
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await channel.track({
            user_id: user.id,
            joined_at: new Date().toISOString(),
            role: 'collaborator'
          });
        }
      } catch (error) {
        console.error('Error setting up realtime:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to live session",
          variant: "destructive"
        });
      }
    };

    setupRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        setIsConnected(false);
      }
    };
  }, [sessionId, toast]);

  // Load session data
  const joinSession = useCallback(async (sessionId: string) => {
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('collaboration_projects')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      const { data: stemsData, error: stemsError } = await supabase
        .from('collaboration_stems')
        .select('*')
        .eq('collaboration_id', sessionId);

      if (stemsError) throw stemsError;

      const formattedTracks: Track[] = stemsData.map(stem => ({
        id: stem.id,
        name: stem.name,
        file_url: stem.file_url,
        stem_type: stem.stem_type,
        uploaded_by: stem.uploaded_by,
        version_number: stem.version_number,
        duration: stem.duration || 0,
        volume: 1,
        isMuted: false,
        isSolo: false
      }));

      setTracks(formattedTracks);
    } catch (error) {
      console.error('Error joining session:', error);
      toast({
        title: "Error",
        description: "Failed to join session",
        variant: "destructive"
      });
    }
  }, [toast]);

  const createSession = useCallback(async (config: CreateSessionData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create the collaboration project first
      const { data: project, error: projectError } = await supabase
        .from('collaboration_projects')
        .insert({
          name: config.name,
          target_bpm: config.bpm,
          target_genre: config.key,
          created_by: user.id,
          workspace_type: config.workspace_type,
          status: 'active'
        })
        .select('id, created_by')
        .single();

      if (projectError) {
        console.error('Project insert error:', projectError);
        throw projectError;
      }

      // Try to add the creator as a member (non-blocking)
      try {
        const { error: memberError } = await supabase
          .from('collaboration_members')
          .insert({
            collaboration_id: project.id,
            user_id: user.id,
            role: 'creator',
            status: 'accepted',
            royalty_percentage: 100
          });
        if (memberError) {
          console.warn('Member insert warning:', memberError);
          // Don't block session creation if membership insert fails
        }
      } catch (memberCatchErr) {
        console.warn('Member insert caught error:', memberCatchErr);
      }

      setSession({
        id: project.id,
        name: config.name,
        target_bpm: config.bpm,
        target_genre: config.key,
        created_by: project.created_by,
        status: 'active',
        workspace_type: config.workspace_type,
      });
      return project.id;
    } catch (error: any) {
      console.error('Error creating session:', error);
      const message = error?.message || 'Failed to create session';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast]);

  // Simplified timing system that works with native audio looping
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  useEffect(() => {
    let rafId: number | null = null;
    
    if (isPlaying) {
      startTimeRef.current = Date.now() - pausedTimeRef.current * 1000;

      const tick = () => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setCurrentTime(elapsed);
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    } else {
      pausedTimeRef.current = currentTime;
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying]);

  const togglePlayback = useCallback(() => {
    const newIsPlaying = !isPlaying;
    
    // Always reset to 0 when starting to ensure clean looping
    if (newIsPlaying) {
      setCurrentTime(0);
      pausedTimeRef.current = 0;
      startTimeRef.current = Date.now();
    }
    
    setIsPlaying(newIsPlaying);
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'playback-control',
        payload: {
          isPlaying: newIsPlaying,
          currentTime: 0
        }
      });
    }
  }, [isPlaying]);

  const seekTo = useCallback((time: number) => {
    // Quantize seek position to nearest beat for exact loop points
    if (session?.target_bpm) {
      const bpm = session.target_bpm;
      const beatsPerSecond = bpm / 60;
      const quantizedBeat = Math.round(time * beatsPerSecond);
      const quantizedTime = quantizedBeat / beatsPerSecond;
      
      setCurrentTime(quantizedTime);
      pausedTimeRef.current = quantizedTime;
      
      if (isPlaying) {
        startTimeRef.current = Date.now() - quantizedTime * 1000;
      }

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'seek',
          payload: {
            currentTime: quantizedTime
          }
        });
      }
    } else {
      // Fallback to regular seek if no BPM is set
      setCurrentTime(time);
      pausedTimeRef.current = time;
      
      if (isPlaying) {
        startTimeRef.current = Date.now() - time * 1000;
      }

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'seek',
          payload: {
            currentTime: time
          }
        });
      }
    }
  }, [isPlaying, session]);

  const addTrack = useCallback(async (file: File, trackName: string, stemType: string) => {
    try {
      if (!session) throw new Error('No active session');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      const { data: stemData, error: stemError } = await supabase
        .from('collaboration_stems')
        .insert({
          collaboration_id: session.id,
          name: trackName,
          file_url: publicUrl,
          stem_type: stemType,
          uploaded_by: user.id,
          version_number: 1,
          file_size: file.size
        })
        .select()
        .single();

      if (stemError) throw stemError;

      const newTrack: Track = {
        id: stemData.id,
        name: stemData.name,
        file_url: stemData.file_url,
        stem_type: stemData.stem_type,
        uploaded_by: stemData.uploaded_by,
        version_number: stemData.version_number,
        duration: 0,
        volume: 1,
        isMuted: false,
        isSolo: false
      };

      setTracks(prev => [...prev, newTrack]);

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'track-added',
          payload: { track: newTrack }
        });
      }

      toast({
        title: "Track Added",
        description: `${trackName} has been added to the session`,
      });
    } catch (error) {
      console.error('Error adding track:', error);
      toast({
        title: "Error",
        description: "Failed to add track",
        variant: "destructive"
      });
    }
  }, [session, toast]);

  const removeTrack = useCallback(async (trackId: string) => {
    try {
      const { error } = await supabase
        .from('collaboration_stems')
        .delete()
        .eq('id', trackId);

      if (error) throw error;

      setTracks(prev => prev.filter(track => track.id !== trackId));

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'track-removed',
          payload: { trackId }
        });
      }
    } catch (error) {
      console.error('Error removing track:', error);
      toast({
        title: "Error",
        description: "Failed to remove track",
        variant: "destructive"
      });
    }
  }, [toast]);

  const updateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, ...updates } : track
    ));

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'track-updated',
        payload: { trackId, updates }
      });
    }
  }, []);

  const updateSessionSettings = useCallback(async (updates: { bpm?: number; key?: string }) => {
    try {
      if (!session) throw new Error('No active session');

      const { error } = await supabase
        .from('collaboration_projects')
        .update({ 
          ...(updates.bpm && { target_bpm: updates.bpm }),
          ...(updates.key && { target_genre: updates.key }),
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      if (error) throw error;

      // Update local session state
      setSession(prev => prev ? {
        ...prev,
        ...(updates.bpm && { target_bpm: updates.bpm }),
        ...(updates.key && { target_genre: updates.key })
      } : null);

      // Broadcast changes to other participants
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'session-settings-updated',
          payload: updates
        });
      }

      toast({
        title: "Settings Updated",
        description: `Session ${updates.bpm ? 'BPM' : ''}${updates.bpm && updates.key ? ' and ' : ''}${updates.key ? 'key' : ''} updated`,
      });
    } catch (error) {
      console.error('Error updating session settings:', error);
      toast({
        title: "Error",
        description: "Failed to update session settings",
        variant: "destructive"
      });
    }
  }, [session, toast]);

  const saveSession = useCallback(async () => {
    try {
      if (!session) throw new Error('No active session');

      const { error } = await supabase
        .from('collaboration_projects')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      if (error) throw error;

      toast({
        title: "Session Saved",
        description: "Your Cook Mode session has been saved successfully",
      });
    } catch (error) {
      console.error('Error saving session:', error);
      toast({
        title: "Error",
        description: "Failed to save session",
        variant: "destructive"
      });
      throw error;
    }
  }, [session, toast]);

  return {
    session,
    participants,
    tracks,
    isPlaying,
    currentTime,
    isConnected,
    createSession,
    joinSession,
    addTrack,
    removeTrack,
    togglePlayback,
    seekTo,
    updateTrack,
    updateSessionSettings,
    saveSession
  };
}