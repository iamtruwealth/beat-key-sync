import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { BeatCard } from "@/components/beats/BeatCard";
import { BeatPackManager } from "@/components/beats/BeatPackManager";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SortByKey } from "@/components/ui/sort-by-key";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/contexts/AudioContext";
import { useCart } from "@/contexts/CartContext";
import { useTrackPlay } from "@/hooks/useTrackPlay";
import { MetaTags } from "@/components/MetaTags";
import StickyHeader from "@/components/layout/StickyHeader";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, Download, Copy, Music, ShoppingCart, Filter } from "lucide-react";
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
  genre?: string;
  artwork_url?: string;
  user_id: string;
  beats: Beat[];
  producer_name?: string;
  producer_logo_url?: string;
}
export default function BeatPackPage() {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const [beatPack, setBeatPack] = useState<BeatPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'none' | 'one' | 'all'>('none');
  const [isOwner, setIsOwner] = useState(false);
  const [keyFilter, setKeyFilter] = useState<string>('all');
  const [filteredBeats, setFilteredBeats] = useState<Beat[]>([]);
  const {
    toast
  } = useToast();
  const {
    currentTrack,
    isPlaying,
    playTrack,
    pauseTrack,
    togglePlayPause,
    currentTime,
    duration,
    seekTo
  } = useAudio();
  const { addToCart } = useCart();
  const { trackPlay } = useTrackPlay();
  useEffect(() => {
    if (id) {
      fetchBeatPack(id);
      // Track view
      trackView(id);
      // Check if user owns this pack
      checkOwnership(id);
    }
  }, [id]);

  // Filter beats based on key selection
  useEffect(() => {
    if (!beatPack) return;
    
    let filtered = [...beatPack.beats];
    
    if (keyFilter && keyFilter !== 'all') {
      filtered = filtered.filter(beat => {
        const beatKey = beat.manual_key || beat.detected_key || beat.key;
        return beatKey === keyFilter;
      });
    }
    
    setFilteredBeats(filtered);
  }, [beatPack, keyFilter]);
  const trackView = async (packId: string) => {
    try {
      await supabase.from('beat_pack_views').insert({
        beat_pack_id: packId,
        ip_address: null // We could implement IP tracking if needed
      });
    } catch (error) {
      // Silently fail - don't impact user experience
      console.debug('View tracking error:', error);
    }
  };

  const trackPackPlay = async (packId: string) => {
    try {
      await supabase.rpc('increment_beat_pack_play_count', {
        pack_id: packId
      });
    } catch (error) {
      console.debug('Pack play tracking error:', error);
    }
  };
  const checkOwnership = async (packId: string) => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const {
        data: packData
      } = await supabase.from('beat_packs').select('user_id').eq('id', packId).single();
      setIsOwner(packData?.user_id === user.id);
    } catch (error) {
      console.debug('Ownership check error:', error);
    }
  };
  const fetchBeatPack = async (packId: string) => {
    try {
      setLoading(true);

      // Fetch beat pack details with producer info
      const {
        data: packData,
        error: packError
      } = await supabase
        .from('beat_packs')
        .select(`
          *,
          profiles!beat_packs_user_id_fkey (
            producer_name,
            producer_logo_url
          )
        `)
        .eq('id', packId)
        .single();
      if (packError) throw packError;

      // Fetch items for this beat pack
      let beats: Beat[] = [];
      if (packData.creation_type === 'auto_tag' && packData.auto_tag) {
        // For auto-generated packs, get beats by tag
        const {
          data: beatsData,
          error: beatsError
        } = await supabase.from('beats').select('*').contains('tags', [packData.auto_tag]);
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
        const {
          data: packBeatsData,
          error: packBeatsError
        } = await supabase.from('beat_pack_tracks').select('track_id, position').eq('beat_pack_id', packId).order('position');
        if (packBeatsError) throw packBeatsError;
        if (packBeatsData && packBeatsData.length > 0) {
          const beatIds = packBeatsData.map(pt => pt.track_id);

          // Fetch all beats from the single beats table
          const {
            data: beatsData
          } = await supabase.from('beats').select('*').in('id', beatIds);

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
        beats,
        producer_name: packData.profiles?.producer_name,
        producer_logo_url: packData.profiles?.producer_logo_url
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
    return <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-xl">Loading beat pack...</div>
      </div>;
  }
  if (!beatPack) {
    return <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Beat Pack Not Found</h1>
          <p className="text-muted-foreground">The beat pack you're looking for doesn't exist.</p>
        </div>
      </div>;
  }
  const handlePlayBeat = async (beat: Beat) => {
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
      manual_bpm: beat.manual_bpm
    };
    playTrack(audioTrack);

    // Track play count for the beat
    await trackPlay(beat.id);
    
    // Track pack play count if it's the first beat played
    if (beatPack && currentTrackIndex === 0) {
      await trackPackPlay(beatPack.id);
    }

    // Update current track index
    const trackIndex = filteredBeats.findIndex(b => b.id === beat.id);
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
    if (!filteredBeats.length) return;
    const newIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : filteredBeats.length - 1;
    setCurrentTrackIndex(newIndex);
    handlePlayBeat(filteredBeats[newIndex]);
  };
  const handleNext = () => {
    if (!filteredBeats.length) return;
    if (repeat === 'one') {
      handlePlayBeat(filteredBeats[currentTrackIndex]);
      return;
    }
    let newIndex;
    if (shuffle) {
      newIndex = Math.floor(Math.random() * filteredBeats.length);
    } else {
      newIndex = currentTrackIndex + 1;
      if (newIndex >= filteredBeats.length) {
        newIndex = repeat === 'all' ? 0 : currentTrackIndex;
      }
    }
    setCurrentTrackIndex(newIndex);
    handlePlayBeat(filteredBeats[newIndex]);
  };
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = clickX / rect.width * duration;
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

  const handleAddToCart = async (beat: Beat) => {
    await addToCart({
      item_type: 'beat',
      item_id: beat.id,
      quantity: 1,
      price_cents: beat.price_cents,
      title: beat.title,
      image_url: beat.artwork_url,
      producer_name: beat.producer_name || beat.artist
    });
  };

  const downloadBeat = async (beat: Beat) => {
    try {
      const response = await fetch(beat.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Create filename with key and BPM
      const key = beat.manual_key || beat.detected_key || '';
      const bpm = beat.manual_bpm || beat.detected_bpm || beat.bpm || '';
      const keyBpmSuffix = [key, bpm ? `${bpm}BPM` : ''].filter(Boolean).join('_');
      const filename = keyBpmSuffix ? `${beat.title}_${keyBpmSuffix}.mp3` : `${beat.title}.mp3`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: `${beat.title} is downloading`
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: "Unable to download beat",
        variant: "destructive"
      });
    }
  };
  const progressPercent = duration ? currentTime / duration * 100 : 0;

  // Get fallback artwork - use pack artwork or producer logo
  const getArtworkUrl = () => {
    return beatPack?.artwork_url || beatPack?.producer_logo_url || null;
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StickyHeader />
        {beatPack && (
          <MetaTags
            title={beatPack.name}
            description={beatPack.description || `Beat pack by ${beatPack.producer_name || 'Unknown Producer'}`}
            image={getArtworkUrl() || undefined}
            url={currentUrl}
          />
        )}
        <div className="container mx-auto px-4 py-8">
          {/* Beat Pack Header */}
          <div className="mb-8">
            <div className="flex items-start gap-6 mb-6">
              {getArtworkUrl() ? <img src={getArtworkUrl()!} alt={beatPack.name} className="w-48 h-48 object-cover rounded-lg shadow-lg" /> : <div className="w-48 h-48 bg-muted rounded-lg shadow-lg flex items-center justify-center">
                  <Music className="w-16 h-16 text-muted-foreground" />
                </div>}
              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-2">{beatPack.name}</h1>
                {beatPack.producer_name && (
                  <p className="text-lg text-muted-foreground mb-4">
                    by{' '}
                    <Link 
                      to={`/producer/${beatPack.user_id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {beatPack.producer_name}
                    </Link>
                  </p>
                )}
                {beatPack.description && <p className="text-lg text-muted-foreground mb-4">{beatPack.description}</p>}
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  {beatPack.genre && (
                    <Badge variant="secondary">{beatPack.genre}</Badge>
                  )}
                  <p className="text-muted-foreground">
                    {beatPack.beats.length} {beatPack.beats.length === 1 ? 'beat' : 'beats'}
                  </p>
                  <Button variant="outline" size="sm" onClick={copyPackLink}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                  {isOwner && <BeatPackManager beatPack={beatPack} onUpdate={() => fetchBeatPack(id!)} />}
                </div>
              </div>
            </div>
          </div>

          {/* Audio Player Controls */}
          {currentTrack && <div className="sticky top-16 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-4 mb-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={handlePrevious} className="h-10 w-10">
                    <SkipBack className="w-5 h-5" />
                  </Button>
                  
                  <Button variant="default" size="icon" onClick={() => isPlaying ? pauseTrack() : handlePlayBeat(beatPack.beats[currentTrackIndex])} className="h-12 w-12 rounded-full">
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </Button>
                  
                  <Button variant="ghost" size="icon" onClick={handleNext} className="h-10 w-10">
                    <SkipForward className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShuffle(!shuffle)} className={shuffle ? "text-primary" : ""}>
                    <Shuffle className="w-4 h-4" />
                  </Button>
                  
                  <Button variant="ghost" size="icon" onClick={() => setRepeat(prev => prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none')} className={repeat !== 'none' ? "text-primary" : ""}>
                    <Repeat className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Now Playing Info */}
              <div className="flex items-center gap-3 mb-3">
                {currentTrack.artwork_url ? <img src={currentTrack.artwork_url} alt={currentTrack.title} className="w-12 h-12 object-cover rounded" /> : <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                    <Music className="w-6 h-6 text-muted-foreground" />
                  </div>}
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
                <div className="flex-1 h-2 bg-muted rounded-full cursor-pointer group" onClick={handleSeek}>
                  <div className="h-full bg-primary rounded-full relative" style={{
                width: `${progressPercent}%`
              }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground w-12">
                  {formatTime(duration || 0)}
                </span>
              </div>
            </div>}

          {/* Filter Controls */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter by Key:</span>
            </div>
            <SortByKey 
              value={keyFilter} 
              onValueChange={setKeyFilter}
              className="w-[180px]"
            />
            <div className="text-sm text-muted-foreground">
              {filteredBeats.length} of {beatPack.beats.length} beats
            </div>
          </div>

          {/* Beats List */}
          <div className="space-y-4">
            {filteredBeats.map((beat, index) => (
              <div key={beat.id} className={`${currentTrack?.id === beat.id ? 'ring-2 ring-primary' : ''} group`}>
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                   <div className="flex items-center gap-4">
                     {/* Play Button with Artwork */}
                     <div className="relative flex-shrink-0">
                       {/* Album Artwork or Producer Profile Picture */}
                       <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                         {beat.artwork_url ? (
                           <img 
                             src={beat.artwork_url} 
                             alt={beat.title}
                             className="w-full h-full object-cover"
                           />
                         ) : beat.profiles?.producer_logo_url ? (
                           <img 
                             src={beat.profiles.producer_logo_url} 
                             alt={beat.profiles.producer_name || 'Producer'}
                             className="w-full h-full object-cover"
                           />
                         ) : beatPack.producer_logo_url ? (
                           <img 
                             src={beatPack.producer_logo_url} 
                             alt={beatPack.producer_name || 'Producer'}
                             className="w-full h-full object-cover"
                           />
                         ) : (
                           <Music className="h-6 w-6 text-muted-foreground" />
                         )}
                       </div>
                       
                       {/* Play/Pause Button Overlay */}
                       <Button
                         variant="secondary"
                         size="icon"
                         onClick={() => handlePlayBeat(beat)}
                         className="absolute inset-0 w-full h-full bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                       >
                         {currentTrack?.id === beat.id && isPlaying ? (
                           <Pause className="w-6 h-6" />
                         ) : (
                           <Play className="w-6 h-6" />
                         )}
                       </Button>
                     </div>

                    {/* Beat Info */}
                    <div className="flex-1">
                      <h3 className="font-semibold">{beat.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {beat.producer_name || beat.artist}
                      </p>
                      <div className="flex gap-2 mt-1">
                        {beat.genre && (
                          <Badge variant="secondary" className="text-xs">
                            {beat.genre}
                          </Badge>
                        )}
                        {(beat.manual_bpm || beat.detected_bpm || beat.bpm) && (
                          <Badge variant="outline" className="text-xs">
                            {beat.manual_bpm || beat.detected_bpm || beat.bpm} BPM
                          </Badge>
                        )}
                        {(beat.manual_key || beat.detected_key || beat.key) && (
                          <Badge variant="outline" className="text-xs">
                            {beat.manual_key || beat.detected_key || beat.key}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {beat.is_free ? (
                        <Button size="sm" onClick={() => downloadBeat(beat)}>
                          <Download className="w-4 h-4 mr-1" />
                          Free Download
                        </Button>
                      ) : (
                        <>
                          <div className="text-lg font-bold mr-2">
                            ${(beat.price_cents / 100).toFixed(2)}
                          </div>
                          <Button size="sm" onClick={() => handleAddToCart(beat)}>
                            <ShoppingCart className="w-4 h-4 mr-1" />
                            Add to Cart
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
  );
}