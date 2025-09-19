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
        // For auto-generated packs, get beats by tag
        const { data: beatsData, error: beatsError } = await supabase
          .from('beats')
          .select('*')
          .contains('tags', [packData.auto_tag]);

        if (beatsError) throw beatsError;

        tracks = (beatsData || []).map(beat => ({
          ...beat,
          artist: beat.artist || 'Unknown Artist',
          producer_name: beat.artist || 'Unknown Producer'
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

          // Transform beat data to match Track interface
          const allItems = (beatsData || []).map(beat => ({
            id: beat.id,
            title: beat.title,
            artist: beat.artist || 'Unknown Artist',
            producer_name: beat.artist || 'Unknown Producer',
            duration: beat.duration || 0,
            file_url: beat.file_url,
            detected_key: beat.detected_key,
            detected_bpm: beat.detected_bpm,
            manual_key: beat.manual_key,
            manual_bpm: beat.manual_bpm,
            artwork_url: beat.artwork_url,
            tags: beat.tags || [],
            genre: beat.genre,
            is_free: beat.is_free,
            price_cents: beat.price_cents
          }));

          // Sort by position from beat_pack_tracks
          tracks = allItems.sort((a, b) => {
            const aPosition = packBeatsData.find(pt => pt.track_id === a.id)?.position || 0;
            const bPosition = packBeatsData.find(pt => pt.track_id === b.id)?.position || 0;
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