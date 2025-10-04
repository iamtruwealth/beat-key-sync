import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAudio } from "@/contexts/AudioContext";

interface EPKMusicPlayerModuleProps {
  module: any;
  themeSettings?: any;
}

export function EPKMusicPlayerModule({ module, themeSettings }: EPKMusicPlayerModuleProps) {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentTrack, isPlaying, playTrack, pauseTrack } = useAudio();

  useEffect(() => {
    loadTracks();
  }, [module]);

  const loadTracks = async () => {
    const trackIds = module.module_data?.track_ids || [];
    if (trackIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('beats')
      .select('*')
      .in('id', trackIds);

    if (!error && data) {
      // Sort by the order in track_ids
      const sortedTracks = trackIds
        .map((id: string) => data.find(t => t.id === id))
        .filter(Boolean);
      setTracks(sortedTracks);
    }
    setLoading(false);
  };

  const handlePlayPause = (track: any) => {
    if (currentTrack?.id === track.id && isPlaying) {
      pauseTrack();
    } else {
      playTrack({
        id: track.id,
        title: track.title,
        artist: track.artist,
        file_url: track.audio_file_url,
        artwork_url: track.artwork_url,
      });
    }
  };

  if (loading) {
    return (
      <Card className="p-8">
        <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {module.custom_title || "Music"}
        </h2>
        <div className="text-center py-12">
          <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading tracks...</p>
        </div>
      </Card>
    );
  }

  if (tracks.length === 0) {
    return (
      <Card className="p-8">
        <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {module.custom_title || "Music"}
        </h2>
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No tracks added yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Edit this module to add up to 10 tracks
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        {module.custom_title || "Music"}
      </h2>
      <div className="space-y-3">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className="flex items-center gap-4 p-4 rounded-lg bg-card/50 hover:bg-card/80 transition-colors border border-border"
          >
            <div className="flex-shrink-0">
              {track.artwork_url ? (
                <img
                  src={track.artwork_url}
                  alt={track.title}
                  className="w-16 h-16 rounded object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded bg-primary/20 flex items-center justify-center">
                  <Music className="w-6 h-6 text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {index + 1}. {track.title}
              </h3>
              {track.artist && (
                <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
              )}
              {track.genre && (
                <p className="text-xs text-muted-foreground">{track.genre}</p>
              )}
            </div>
            <Button
              size="icon"
              variant={currentTrack?.id === track.id && isPlaying ? "default" : "outline"}
              onClick={() => handlePlayPause(track)}
            >
              {currentTrack?.id === track.id && isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
