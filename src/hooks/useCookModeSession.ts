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
  analyzed_duration?: number;
  bars?: number;
  trimStart?: number; // Start time in seconds for trimming
  trimEnd?: number;   // End time in seconds for trimming
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
            // Enrich with profile data
            (async () => {
              try {
                const userIds = Array.from(new Set(participantList.map(p => p.user_id))).filter(Boolean);
                if (userIds.length > 0) {
                  const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, producer_name, producer_logo_url')
                    .in('id', userIds as string[]);
                  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
              const enriched = participantList.map(p => ({
                ...p,
                profile: profileMap.has(p.user_id)
                  ? {
                      producer_name: (profileMap.get(p.user_id) as any)?.producer_name,
                      producer_logo_url: (profileMap.get(p.user_id) as any)?.producer_logo_url,
                    }
                  : p.profile,
              }));
              
              // Sort participants so creator is always first
              const sortedParticipants = enriched.sort((a, b) => {
                if (a.role === 'creator') return -1;
                if (b.role === 'creator') return 1;
                return a.joined_at.localeCompare(b.joined_at);
              });
              
              setParticipants(sortedParticipants);
            } else {
              // Sort participants so creator is always first
              const sortedParticipants = participantList.sort((a, b) => {
                if (a.role === 'creator') return -1;
                if (b.role === 'creator') return 1;
                return a.joined_at.localeCompare(b.joined_at);
              });
              setParticipants(sortedParticipants);
            }
              } catch (e) {
                console.warn('Failed to enrich participants with profiles', e);
                setParticipants(participantList);
              }
            })();
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
          // Check if this user is the session creator to assign correct role
          const { data: sessionData } = await supabase
            .from('collaboration_projects')
            .select('created_by')
            .eq('id', sessionId)
            .single();
          
          const isCreator = sessionData?.created_by === user.id;
          
          await channel.track({
            user_id: user.id,
            joined_at: new Date().toISOString(),
            role: isCreator ? 'creator' : 'collaborator'
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

      const generateId = () => {
        try {
          // Prefer native crypto.randomUUID when available
          // @ts-ignore
          if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            // @ts-ignore
            return crypto.randomUUID();
          }
        } catch {}
        // Fallback UUID v4 generator
        let d = Date.now();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (d + Math.random() * 16) % 16 | 0;
          d = Math.floor(d / 16);
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
      };

      const newId = generateId();

      const insertPayload = {
        id: newId,
        name: config.name,
        target_bpm: config.bpm,
        target_genre: config.key,
        created_by: user.id,
        workspace_type: config.workspace_type,
        status: 'active'
      };

      console.log('[CookMode] Creating collaboration project', insertPayload);

      const { error: projectError } = await supabase
        .from('collaboration_projects')
        .insert(insertPayload);

      if (projectError) {
        console.error('Project insert error:', projectError);
        throw projectError;
      }

      console.log('[CookMode] Collaboration project created', newId);

      // Try to add the creator as a member (non-blocking)
      try {
        const { error: memberError } = await supabase
          .from('collaboration_members')
          .insert({
            collaboration_id: newId,
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
        id: newId,
        name: config.name,
        target_bpm: config.bpm,
        target_genre: config.key,
        created_by: user.id,
        status: 'active',
        workspace_type: config.workspace_type,
      });
      return newId;
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

  // Time tracking
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying) {
      startTimeRef.current = Date.now() - pausedTimeRef.current * 1000;
      
      interval = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setCurrentTime(elapsed);
      }, 100);
    } else {
      pausedTimeRef.current = currentTime;
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  const togglePlayback = useCallback(() => {
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'playback-control',
        payload: {
          isPlaying: newIsPlaying,
          currentTime: currentTime
        }
      });
    }
  }, [isPlaying, currentTime]);

  const seekTo = useCallback((time: number) => {
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
  }, [isPlaying]);

  const addTrack = useCallback(async (file: File, trackName: string, stemType: string) => {
    try {
      if (!session) throw new Error('No active session');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Quick duration probe BEFORE upload so timeline can size correctly
      let quickDuration = 0;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        quickDuration = audioBuffer.duration || 0;
        audioCtx.close?.();
        console.log(`[CookMode] Quick duration probe for ${trackName}:`, quickDuration);
      } catch (e) {
        console.warn('[CookMode] Quick duration probe failed:', e);
      }

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
          file_size: file.size,
          // Persist duration server-side when possible
          duration: quickDuration
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
        duration: quickDuration || 0,
        volume: 1,
        isMuted: false,
        isSolo: false,
        analyzed_duration: quickDuration || 0
      };

      setTracks(prev => [...prev, newTrack]);

      // Broadcast to other participants so their timelines size correctly
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'track-added',
          payload: { track: newTrack }
        });
      }

      toast({
        title: 'Track Added',
        description: `${trackName} has been added to the session`,
      });
    } catch (error) {
      console.error('Error adding track:', error);
      toast({
        title: 'Error',
        description: 'Failed to add track',
        variant: 'destructive'
      });
    }
  }, [session, toast]);

  // Add empty recordable track
  const addEmptyTrack = useCallback(async (trackName: string) => {
    try {
      if (!session) throw new Error('No active session');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create a new track without a file for recording
      const newTrack: Track = {
        id: `empty-track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: trackName,
        file_url: '', // Empty for recordable tracks
        stem_type: 'recording',
        uploaded_by: user.id,
        version_number: 1,
        duration: 0,
        volume: 1,
        isMuted: false,
        isSolo: false
      };

      setTracks(prev => [...prev, newTrack]);

      // Broadcast to other participants
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'track-added',
          payload: { track: newTrack }
        });
      }

      toast({
        title: "Track Created",
        description: `Created empty track: ${trackName}`,
      });

      return newTrack.id;
    } catch (error) {
      console.error('Error creating empty track:', error);
      toast({
        title: "Error",
        description: "Failed to create track",
        variant: "destructive"
      });
      throw error;
    }
  }, [session, toast]);

  const removeTrack = useCallback(async (trackId: string) => {
    try {
      // Check if this is an empty track (starts with 'empty-track-') or a real database track
      const isEmptyTrack = trackId.startsWith('empty-track-');
      
      if (!isEmptyTrack) {
        // Only try to delete from database if it's a real track with a proper UUID
        const { error } = await supabase
          .from('collaboration_stems')
          .delete()
          .eq('id', trackId);

        if (error) throw error;
      }

      // Remove from local state (works for both empty tracks and database tracks)
      setTracks(prev => prev.filter(track => track.id !== trackId));

      // Broadcast removal to other participants
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'track-removed',
          payload: { trackId }
        });
      }

      toast({
        title: "Track Removed",
        description: "Track removed successfully",
      });

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

  const trimTrack = useCallback((trackId: string, trimStart: number, trimEnd: number) => {
    const updates = { trimStart, trimEnd };
    updateTrack(trackId, updates);
  }, [updateTrack]);

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

  const saveSession = useCallback(async (publishImmediately = false) => {
    try {
      if (!session) throw new Error('No active session');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update session status based on action
      const newStatus = publishImmediately ? 'completed' : 'saved';
      
      const { error } = await supabase
        .from('collaboration_projects')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      if (error) throw error;

      // Create a collaboration session record for tracking
      const { error: sessionError } = await supabase
        .from('collaboration_sessions')
        .upsert({
          collaboration_id: session.id,
          started_by: user.id,
          session_type: 'cook_mode',
          participants: participants.map(p => p.user_id),
          ...(publishImmediately && { ended_at: new Date().toISOString() })
        }, {
          onConflict: 'collaboration_id,started_by'
        });

      if (sessionError) {
        console.warn('Session tracking error:', sessionError);
        // Don't block the main save operation
      }

      // Notify other participants about the session save
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'session-saved',
          payload: { 
            sessionId: session.id,
            published: publishImmediately,
            savedBy: user.id
          }
        });
      }

      // Call edge function to send notifications to collaborators
      try {
        const { error: notifyError } = await supabase.functions.invoke('notify-session-save', {
          body: {
            sessionId: session.id,
            published: publishImmediately,
            savedBy: user.id
          }
        });

        if (notifyError) {
          console.warn('Notification error:', notifyError);
          // Don't block the save operation
        }
      } catch (notifyErr) {
        console.warn('Failed to send notifications:', notifyErr);
      }

      // Update local session state
      setSession(prev => prev ? { ...prev, status: newStatus } : null);

      const action = publishImmediately ? 'published' : 'saved';
      toast({
        title: `Session ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        description: `Your Cook Mode session has been ${action} successfully`,
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
  }, [session, participants, toast]);

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
    trimTrack,
    updateSessionSettings,
    saveSession,
    addEmptyTrack
  };
}