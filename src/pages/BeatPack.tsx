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
    }
  }, [id]);

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

      // Fetch tracks for this beat pack
      let tracksQuery;
      
      if (packData.creation_type === 'auto_tag' && packData.auto_tag) {
        // For auto-generated packs, get tracks by tag (include artist)
        tracksQuery = supabase
          .from('tracks')
          .select('*')
          .contains('tags', [packData.auto_tag]);
      } else {
        // For manual packs, get tracks from junction table (include artist)
        tracksQuery = supabase
          .from('beat_pack_tracks')
          .select(`
            tracks (
              id,
              title,
              artist,
              file_url,
              duration,
              detected_key,
              detected_bpm,
              manual_key,
              manual_bpm
            )
          `)
          .eq('beat_pack_id', packId)
          .order('position');
      }

      const { data: tracksData, error: tracksError } = await tracksQuery;

      if (tracksError) throw tracksError;

      // Transform tracks data
      let tracks: Track[];
      if (packData.creation_type === 'auto_tag') {
        tracks = (tracksData || []).map(track => ({
          ...track,
          artist: track.artist || 'Unknown Artist',
          producer_name: track.artist || 'Unknown Producer'
        }));
      } else {
        tracks = (tracksData || []).map((item: any) => ({
          ...item.tracks,
          artist: item.tracks.artist || 'Unknown Artist',
          producer_name: item.tracks.artist || 'Unknown Producer'
        }));
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