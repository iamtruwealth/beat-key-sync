import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Pause, Users, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAudio } from "@/contexts/AudioContext";

interface Beat {
  id: string;
  title: string;
  artist: string;
  file_url: string;
  artwork_url?: string;
  duration?: number;
  detected_key?: string;
  detected_bpm?: number;
  manual_key?: string;
  manual_bpm?: number;
}

interface Producer {
  id: string;
  name: string;
  avatar: string;
  location: string;
  followers: number;
  tracksCount: number;
  genres: string[];
  previewTrack?: Beat;
}

export default function Explore() {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, playTrack, pauseTrack } = useAudio();
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducers();
  }, []);

  const fetchProducers = async () => {
    try {
      // Fetch producers with their latest beats
      const { data: producersData, error: producersError } = await supabase
        .from('profiles')
        .select(`
          id,
          producer_name,
          producer_logo_url,
          location,
          verification_status
        `)
        .not('producer_name', 'is', null)
        .limit(12);

      if (producersError) throw producersError;

      // For each producer, get their latest beat
      const producersWithBeats = await Promise.all(
        (producersData || []).map(async (producer) => {
          const { data: beatsData } = await supabase
            .from('beats')
            .select('*')
            .eq('producer_id', producer.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const latestBeat = beatsData?.[0];

          return {
            id: producer.id,
            name: producer.producer_name || 'Unknown Producer',
            avatar: producer.producer_logo_url || '',
            location: producer.location || 'Location Unknown',
            followers: Math.floor(Math.random() * 20000) + 1000, // Mock data
            tracksCount: Math.floor(Math.random() * 100) + 1, // Mock data
            genres: ['Hip Hop', 'R&B', 'Trap'], // Mock data
            previewTrack: latestBeat ? {
              id: latestBeat.id,
              title: latestBeat.title,
              artist: latestBeat.artist || producer.producer_name,
              file_url: latestBeat.file_url,
              artwork_url: latestBeat.artwork_url,
              duration: latestBeat.duration,
              detected_key: latestBeat.detected_key,
              detected_bpm: latestBeat.detected_bpm,
              manual_key: latestBeat.manual_key,
              manual_bpm: latestBeat.manual_bpm
            } : undefined
          };
        })
      );

      setProducers(producersWithBeats); // Show all producers, even without preview tracks
    } catch (error) {
      console.error('Error fetching producers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPreview = (beat: Beat) => {
    if (currentTrack?.id === beat.id && isPlaying) {
      pauseTrack();
    } else {
      playTrack(beat);
    }
  };

  const handleProducerClick = (producerId: string, producerName: string) => {
    // Navigate to producer profile
    navigate(`/producer/${producerId}`);
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Explore Producers
          </h1>
          <p className="text-muted-foreground">
            Discover talented producers and their latest tracks
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Explore Producers
        </h1>
        <p className="text-muted-foreground">
          Discover talented producers and their latest tracks
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {producers.map((producer) => (
          <Card key={producer.id} className="overflow-hidden bg-card/50 border-border/50 hover:bg-card/70 transition-colors">
            <CardContent className="p-6 space-y-4">
              {/* Producer Header */}
              <div className="flex items-start gap-4">
                <button
                  onClick={() => handleProducerClick(producer.id, producer.name)}
                  className="transition-transform hover:scale-105"
                >
                  <Avatar className="w-16 h-16 border-2 border-primary/20">
                    <AvatarImage src={producer.avatar} alt={producer.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                      {producer.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                </button>
                
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => handleProducerClick(producer.id, producer.name)}
                    className="text-left hover:text-primary transition-colors"
                  >
                    <h3 className="font-semibold text-foreground truncate">
                      {producer.name}
                    </h3>
                  </button>
                  <p className="text-sm text-muted-foreground">
                    {producer.location}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {producer.followers.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      {producer.tracksCount} tracks
                    </div>
                  </div>
                </div>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-1">
                {producer.genres.slice(0, 3).map((genre) => (
                  <span 
                    key={genre}
                    className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              {/* Preview Track */}
              {producer.previewTrack && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      Latest Track
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {producer.previewTrack.title}
                    </p>
                  </div>

                  {/* Track Info */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span>{formatTime(producer.previewTrack.duration || 0)}</span>
                      {(producer.previewTrack.manual_bpm || producer.previewTrack.detected_bpm) && (
                        <span>{producer.previewTrack.manual_bpm || producer.previewTrack.detected_bpm} BPM</span>
                      )}
                      {(producer.previewTrack.manual_key || producer.previewTrack.detected_key) && (
                        <span>{producer.previewTrack.manual_key || producer.previewTrack.detected_key}</span>
                      )}
                    </div>
                  </div>

                  {/* Waveform Placeholder */}
                  <div className="h-12 bg-muted/30 rounded-lg flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 opacity-60"></div>
                    <div className="relative flex items-center gap-1">
                      {Array.from({ length: 40 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-primary/60 rounded-full"
                          style={{
                            height: `${Math.random() * 20 + 10}px`
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Play Button */}
                  <Button 
                    onClick={() => handlePlayPreview(producer.previewTrack!)}
                    variant="outline" 
                    size="sm" 
                    className="w-full bg-background/50 border-primary/30 hover:bg-primary/10"
                  >
                    {currentTrack?.id === producer.previewTrack.id && isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Track
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Preview Track
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}