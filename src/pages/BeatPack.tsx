import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Track {
  id: string;
  title: string;
  artist: string;
  producer_name?: string;
  duration: number;
  file_url: string;
  detected_key?: string;
  detected_bpm?: number;
  manual_key?: string;
  manual_bpm?: number;
}

interface BeatPack {
  id: string;
  name: string;
  description?: string;
  artwork_url?: string;
  tracks: Track[];
}

export default function BeatPackPage() {
  const { id } = useParams<{ id: string }>();
  const [beatPack, setBeatPack] = useState<BeatPack | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
      let tracks: Track[] = [];
      
      if (packData.creation_type === 'auto_tag' && packData.auto_tag) {
        // For auto-generated packs, get tracks by tag
        const { data: tracksData, error: tracksError } = await supabase
          .from('tracks')
          .select('*')
          .contains('tags', [packData.auto_tag]);

        if (tracksError) throw tracksError;

        tracks = (tracksData || []).map(track => ({
          ...track,
          artist: track.artist || 'Unknown Artist',
          producer_name: track.artist || 'Unknown Producer'
        }));
      } else {
        // For manual packs, get both tracks and beats from junction table
        const { data: packTracksData, error: packTracksError } = await supabase
          .from('beat_pack_tracks')
          .select('track_id, position')
          .eq('beat_pack_id', packId)
          .order('position');

        if (packTracksError) throw packTracksError;

        if (packTracksData && packTracksData.length > 0) {
          const trackIds = packTracksData.map(pt => pt.track_id);

          // Try to fetch from tracks table first
          const { data: tracksData } = await supabase
            .from('tracks')
            .select('*')
            .in('id', trackIds);

          // Try to fetch from beats table
          const { data: beatsData } = await supabase
            .from('beats')
            .select('*')
            .in('id', trackIds);

          // Combine and transform data
          const allItems = [
            ...(tracksData || []).map(track => ({
              id: track.id,
              title: track.title,
              artist: track.artist || 'Unknown Artist',
              producer_name: track.artist || 'Unknown Producer',
              duration: track.duration || 0,
              file_url: track.file_url,
              detected_key: track.detected_key,
              detected_bpm: track.detected_bpm,
              manual_key: track.manual_key,
              manual_bpm: track.manual_bpm,
              type: 'track'
            })),
            ...(beatsData || []).map(beat => ({
              id: beat.id,
              title: beat.title,
              artist: 'Unknown Artist',
              producer_name: 'Unknown Producer',
              duration: 120, // Default duration for beats
              file_url: beat.audio_file_url,
              detected_key: beat.key,
              detected_bpm: beat.bpm,
              manual_key: beat.key,
              manual_bpm: beat.bpm,
              type: 'beat'
            }))
          ];

          // Sort by position from beat_pack_tracks
          tracks = allItems.sort((a, b) => {
            const aPosition = packTracksData.find(pt => pt.track_id === a.id)?.position || 0;
            const bPosition = packTracksData.find(pt => pt.track_id === b.id)?.position || 0;
            return aPosition - bPosition;
          });
        }
      }

      setBeatPack({
        ...packData,
        tracks
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
      <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">
        <div className="text-xl">Loading beat pack...</div>
      </div>
    );
  }

  if (!beatPack) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Beat Pack Not Found</h1>
          <p className="text-[#b3b3b3]">The beat pack you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return <SpotifyPlayer beatPack={beatPack} />;
}