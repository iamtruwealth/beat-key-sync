import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { BeatCard } from "@/components/beats/BeatCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/contexts/AudioContext";

interface Beat {
  id: string;
  title: string;
  artist: string;
  producer_name?: string;
  duration: number;
  file_url: string;
  audio_file_url: string;
  detected_key?: string;
  detected_bpm?: number;
  manual_key?: string;
  manual_bpm?: number;
  artwork_url?: string;
  tags?: string[];
  genre?: string;
  is_free: boolean;
  price_cents: number;
  description?: string;
  bpm?: number;
  key?: string;
  profiles?: {
    producer_name?: string;
    producer_logo_url?: string;
  };
}

interface BeatPack {
  id: string;
  name: string;
  description?: string;
  artwork_url?: string;
  beats: Beat[];
}

export default function BeatPackPage() {
  const { id } = useParams<{ id: string }>();
  const [beatPack, setBeatPack] = useState<BeatPack | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentTrack, isPlaying, playTrack } = useAudio();

  useEffect(() => {
    if (id) {
      fetchBeatPack(id);
      // Track view
      trackView(id);
    }
  }, [id]);

  const trackView = async (packId: string) => {
    try {
      await supabase
        .from('beat_pack_views')
        .insert({
          beat_pack_id: packId,
          ip_address: null // We could implement IP tracking if needed
        });
    } catch (error) {
      // Silently fail - don't impact user experience
      console.debug('View tracking error:', error);
    }
  };

  const fetchBeatPack = async (packId: string) => {
    try {
      setLoading(true);

      // Fetch beat pack details
      const { data: packData, error: packError } = await supabase
        .from('beat_packs')
        .select('*')
        .eq('id', packId)
        .single();

      if (packError) throw packError;

      // Fetch items for this beat pack
      let beats: Beat[] = [];
      
      if (packData.creation_type === 'auto_tag' && packData.auto_tag) {
        // For auto-generated packs, get beats by tag
        const { data: beatsData, error: beatsError } = await supabase
          .from('beats')
          .select('*')
          .contains('tags', [packData.auto_tag]);

        if (beatsError) throw beatsError;

        beats = (beatsData || []).map(beat => ({
          ...beat,
          artist: beat.artist || 'Unknown Artist',
          producer_name: beat.artist || 'Unknown Producer',
          audio_file_url: beat.file_url,
          bpm: beat.manual_bpm || beat.detected_bpm,
          key: beat.manual_key || beat.detected_key
        }));
      } else {
        // For manual packs, get beats from junction table
        const { data: packBeatsData, error: packBeatsError } = await supabase
          .from('beat_pack_tracks')
          .select('track_id, position')
          .eq('beat_pack_id', packId)
          .order('position');

        if (packBeatsError) throw packBeatsError;

        if (packBeatsData && packBeatsData.length > 0) {
          const beatIds = packBeatsData.map(pt => pt.track_id);

          // Fetch all beats from the single beats table
          const { data: beatsData } = await supabase
            .from('beats')
            .select('*')
            .in('id', beatIds);

          // Transform beat data to match Beat interface
          const allItems = (beatsData || []).map(beat => ({
            ...beat,
            artist: beat.artist || 'Unknown Artist',
            producer_name: beat.artist || 'Unknown Producer',
            audio_file_url: beat.file_url,
            bpm: beat.manual_bpm || beat.detected_bpm,
            key: beat.manual_key || beat.detected_key
          }));

          // Sort by position from beat_pack_tracks
          beats = allItems.sort((a, b) => {
            const aPosition = packBeatsData.find(pt => pt.track_id === a.id)?.position || 0;
            const bPosition = packBeatsData.find(pt => pt.track_id === b.id)?.position || 0;
            return aPosition - bPosition;
          });
        }
      }

      setBeatPack({
        ...packData,
        beats
      });

    } catch (error) {
      console.error('Error fetching beat pack:', error);
      toast({
        title: "Error",
        description: "Failed to load beat pack",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-xl">Loading beat pack...</div>
      </div>
    );
  }

  if (!beatPack) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Beat Pack Not Found</h1>
          <p className="text-muted-foreground">The beat pack you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const handlePlayBeat = (beat: Beat) => {
    const audioTrack = {
      id: beat.id,
      title: beat.title,
      artist: beat.producer_name || beat.artist || 'Unknown Artist',
      file_url: beat.file_url,
      artwork_url: beat.artwork_url,
      duration: beat.duration,
      detected_key: beat.detected_key,
      detected_bpm: beat.detected_bpm,
      manual_key: beat.manual_key,
      manual_bpm: beat.manual_bpm,
    };
    playTrack(audioTrack);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Beat Pack Header */}
        <div className="mb-8">
          <div className="flex items-start gap-6 mb-6">
            {beatPack.artwork_url && (
              <img 
                src={beatPack.artwork_url} 
                alt={beatPack.name}
                className="w-48 h-48 object-cover rounded-lg shadow-lg"
              />
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-4">{beatPack.name}</h1>
              {beatPack.description && (
                <p className="text-lg text-muted-foreground mb-4">{beatPack.description}</p>
              )}
              <p className="text-muted-foreground">
                {beatPack.beats.length} {beatPack.beats.length === 1 ? 'beat' : 'beats'}
              </p>
            </div>
          </div>
        </div>

        {/* Beats List */}
        <div className="space-y-4">
          {beatPack.beats.map((beat) => (
            <BeatCard
              key={beat.id}
              beat={beat}
              isPlaying={currentTrack?.id === beat.id && isPlaying}
              onPlay={() => handlePlayBeat(beat)}
              onPause={() => {/* pause handled by audio context */}}
              showPurchase={true}
            />
          ))}
        </div>
      </div>
    </div>
  );
}