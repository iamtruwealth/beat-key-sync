import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { BeatCard } from "@/components/beats/BeatCard";
import { BeatPackManager } from "@/components/beats/BeatPackManager";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/contexts/AudioContext";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Volume2,
  Download,
  Copy,
  Music
} from "lucide-react";

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
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'none' | 'one' | 'all'>('none');
  const [isOwner, setIsOwner] = useState(false);
  const { toast } = useToast();
  const { currentTrack, isPlaying, playTrack, pauseTrack, togglePlayPause, currentTime, duration, seekTo } = useAudio();

  useEffect(() => {
    if (id) {
      fetchBeatPack(id);
      // Track view
      trackView(id);
      // Check if user owns this pack
      checkOwnership(id);
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

  const checkOwnership = async (packId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: packData } = await supabase
        .from('beat_packs')
        .select('user_id')
        .eq('id', packId)
        .single();

      setIsOwner(packData?.user_id === user.id);
    } catch (error) {
      console.debug('Ownership check error:', error);
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
    
    // Update current track index
    const trackIndex = beatPack.beats.findIndex(b => b.id === beat.id);
    if (trackIndex !== -1) {
      setCurrentTrackIndex(trackIndex);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePrevious = () => {
    if (!beatPack) return;
    const newIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : beatPack.beats.length - 1;
    setCurrentTrackIndex(newIndex);
    handlePlayBeat(beatPack.beats[newIndex]);
  };

  const handleNext = () => {
    if (!beatPack) return;
    
    if (repeat === 'one') {
      handlePlayBeat(beatPack.beats[currentTrackIndex]);
      return;
    }

    let newIndex;
    if (shuffle) {
      newIndex = Math.floor(Math.random() * beatPack.beats.length);
    } else {
      newIndex = currentTrackIndex + 1;
      if (newIndex >= beatPack.beats.length) {
        newIndex = repeat === 'all' ? 0 : currentTrackIndex;
      }
    }
    
    setCurrentTrackIndex(newIndex);
    handlePlayBeat(beatPack.beats[newIndex]);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    seekTo(newTime);
  };

  const copyPackLink = () => {
    const url = `${window.location.origin}/pack/${beatPack?.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Beat pack link copied to clipboard"
    });
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Beat Pack Header */}
        <div className="mb-8">
          <div className="flex items-start gap-6 mb-6">
            {beatPack.artwork_url ? (
              <img 
                src={beatPack.artwork_url} 
                alt={beatPack.name}
                className="w-48 h-48 object-cover rounded-lg shadow-lg"
              />
            ) : (
              <div className="w-48 h-48 bg-muted rounded-lg shadow-lg flex items-center justify-center">
                <Music className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-4">{beatPack.name}</h1>
              {beatPack.description && (
                <p className="text-lg text-muted-foreground mb-4">{beatPack.description}</p>
              )}
              <div className="flex items-center gap-4 mb-4">
                <p className="text-muted-foreground">
                  {beatPack.beats.length} {beatPack.beats.length === 1 ? 'beat' : 'beats'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyPackLink}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
                {isOwner && (
                  <BeatPackManager
                    beatPack={beatPack}
                    onUpdate={() => fetchBeatPack(id!)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Audio Player Controls */}
        {currentTrack && (
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-4 mb-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevious}
                  className="h-10 w-10"
                >
                  <SkipBack className="w-5 h-5" />
                </Button>
                
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => isPlaying ? pauseTrack() : handlePlayBeat(beatPack.beats[currentTrackIndex])}
                  className="h-12 w-12 rounded-full"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNext}
                  className="h-10 w-10"
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShuffle(!shuffle)}
                  className={shuffle ? "text-primary" : ""}
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRepeat(prev => 
                    prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none'
                  )}
                  className={repeat !== 'none' ? "text-primary" : ""}
                >
                  <Repeat className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Now Playing Info */}
            <div className="flex items-center gap-3 mb-3">
              {currentTrack.artwork_url ? (
                <img 
                  src={currentTrack.artwork_url} 
                  alt={currentTrack.title}
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                  <Music className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{currentTrack.title}</p>
                <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12 text-right">
                {formatTime(currentTime)}
              </span>
              <div 
                className="flex-1 h-2 bg-muted rounded-full cursor-pointer group"
                onClick={handleSeek}
              >
                <div 
                  className="h-full bg-primary rounded-full relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100" />
                </div>
              </div>
              <span className="text-xs text-muted-foreground w-12">
                {formatTime(duration || 0)}
              </span>
            </div>
          </div>
        )}

        {/* Beats List */}
        <div className="space-y-4">
          {beatPack.beats.map((beat, index) => (
            <div 
              key={beat.id}
              className={`${currentTrack?.id === beat.id ? 'ring-2 ring-primary' : ''}`}
            >
              <BeatCard
                beat={beat}
                isPlaying={currentTrack?.id === beat.id && isPlaying}
                onPlay={() => handlePlayBeat(beat)}
                onPause={() => {/* pause handled by audio context */}}
                showPurchase={true}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}