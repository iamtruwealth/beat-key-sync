import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import BeatPackCard from './BeatPackCard';

interface BeatPack {
  id: string;
  name: string;
  description: string;
  artwork_url: string;
  genre: string;
  play_count: number;
  user: {
    id: string;
    producer_name: string;
    producer_logo_url: string;
  };
  track_count: number;
  sample_bpm?: number;
  sample_key?: string;
  total_price_cents: number;
  total_play_count: number;
}

interface BeatPackGridProps {
  beatPacks: BeatPack[];
  loading?: boolean;
}

export default function BeatPackGrid({ beatPacks, loading }: BeatPackGridProps) {
  const [playingPackId, setPlayingPackId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const handlePlayPack = async (packId: string) => {
    if (playingPackId === packId) {
      // Pause current audio
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      setPlayingPackId(null);
      return;
    }

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }

    try {
      // Get the first track in the pack
      const { data: firstTrack } = await supabase
        .from('beat_pack_tracks')
        .select('track_id')
        .eq('beat_pack_id', packId)
        .order('position', { ascending: true })
        .limit(1)
        .single();

      if (firstTrack) {
        // Get the beat data for the first track
        const { data: beat } = await supabase
          .from('beats')
          .select('audio_file_url, title')
          .eq('id', firstTrack.track_id)
          .single();

        if (beat?.audio_file_url) {
          // Create and play audio
          const audio = new Audio(beat.audio_file_url);
          setCurrentAudio(audio);
          
          // Increment play counts when audio starts playing
          audio.onplay = async () => {
            try {
              // Increment beat play count
              await supabase.rpc('increment_beat_play_count', { 
                beat_id: firstTrack.track_id 
              });
              
              // Increment beat pack play count
              await supabase.rpc('increment_beat_pack_play_count', { 
                pack_id: packId 
              });
            } catch (error) {
              console.error('Error incrementing play counts:', error);
            }
          };
          
          audio.play();
          setPlayingPackId(packId);
          
          audio.onended = () => {
            setPlayingPackId(null);
            setCurrentAudio(null);
          };
          audio.onerror = () => {
            setPlayingPackId(null);
            setCurrentAudio(null);
          };
        }
      }
    } catch (error) {
      console.error('Error playing pack:', error);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border bg-card">
            <div className="aspect-square bg-muted animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {beatPacks.map((pack) => (
        <BeatPackCard 
          key={pack.id} 
          pack={pack} 
          playingPackId={playingPackId}
          currentAudio={currentAudio}
          onPlay={handlePlayPack}
        />
      ))}
    </div>
  );
}