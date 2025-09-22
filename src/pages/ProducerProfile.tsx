import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SortByKey } from '@/components/ui/sort-by-key';
import { ShareProfile } from '@/components/ShareProfile';
import { Play, Pause, Download, ShoppingCart, MapPin, Users, Music2, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useAudio } from '@/contexts/AudioContext';
import { useTrackPlay } from '@/hooks/useTrackPlay';
import StickyHeader from '@/components/layout/StickyHeader';
import { MetaTags } from '@/components/MetaTags';
import verifiedBadge from '@/assets/verified-badge.png';
import BeatPackGrid from '@/components/beats/BeatPackGrid';
import hipHopCollageFallback from '@/assets/hip-hop-collage-fallback.png';
import { useTrackDownload } from '@/hooks/useTrackDownload';
import { CompactWaveformPlayer } from '@/components/player/CompactWaveformPlayer';

interface Profile {
  id: string;
  username: string;
  producer_name: string;
  producer_logo_url: string;
  banner_url: string;
  bio: string;
  home_town: string;
  genres: string[];
  total_earnings_cents: number;
  verification_status: string;
}

interface BeatPack {
  id: string;
  name: string;
  description: string;
  artwork_url: string;
  genre: string;
  play_count: number;
  track_count: number;
  user: {
    id: string;
    producer_name: string;
    producer_logo_url: string;
  };
  total_price_cents: number;
  total_play_count: number;
}

interface Beat {
  id: string;
  title: string;
  artist: string;
  file_url?: string;
  audio_file_url: string;
  artwork_url: string;
  bpm: number;
  manual_bpm: number;
  detected_bpm: number;
  key: string;
  manual_key: string;
  detected_key: string;
  genre: string;
  tags: string[];
  price_cents: number;
  play_count: number;
  download_count: number;
  is_free: boolean;
}

export default function ProducerProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [filteredBeats, setFilteredBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyFilter, setKeyFilter] = useState<string>('all');
  const { addToCart } = useCart();
  const { currentTrack, isPlaying, playTrack, pauseTrack } = useAudio();
  const { trackPlay } = useTrackPlay();
  const { trackDownload } = useTrackDownload();

  useEffect(() => {
    if (!id) return;

    const fetchProducerData = async () => {
      try {
        // Fetch producer profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, producer_name, producer_logo_url, banner_url, bio, home_town, genres, total_earnings_cents, verification_status')
          .eq('id', id)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Fetch producer's beat packs with full data
        const { data: beatPacksData, error: beatPacksError } = await supabase
          .from('beat_packs')
          .select(`
            id,
            name,
            description,
            artwork_url,
            genre,
            play_count,
            profiles!beat_packs_user_id_fkey(
              id,
              producer_name,
              producer_logo_url,
              verification_status
            ),
            beat_pack_tracks(count)
          `)
          .eq('user_id', id)
          .eq('is_public', true);

        if (beatPacksError) throw beatPacksError;
        
        // Calculate totals for each pack
        const formattedBeatPacks = await Promise.all((beatPacksData || []).map(async (pack) => {
          // Get track IDs in this pack
          const { data: packTracks } = await supabase
            .from('beat_pack_tracks')
            .select('track_id')
            .eq('beat_pack_id', pack.id);

          let totalPriceCents = 0;
          let totalPlayCount = 0;

          if (packTracks && packTracks.length > 0) {
            // Get beat information for each track
            const trackIds = packTracks.map(t => t.track_id);
            
            const { data: beats } = await supabase
              .from('beats')
              .select('price_cents, play_count')
              .in('id', trackIds);

            if (beats) {
              beats.forEach((beat) => {
                totalPriceCents += beat.price_cents || 0;
                totalPlayCount += beat.play_count || 0;
              });
            }
          }
          
          return {
            ...pack,
            user: Array.isArray(pack.profiles) ? pack.profiles[0] : pack.profiles,
            track_count: pack.beat_pack_tracks?.[0]?.count || 0,
            total_price_cents: totalPriceCents,
            total_play_count: totalPlayCount
          };
        }));
        
        setBeatPacks(formattedBeatPacks);

        // Fetch producer's beats
        const { data: beatsData, error: beatsError } = await supabase
          .from('beats')
          .select('*')
          .eq('producer_id', id)
          .order('play_count', { ascending: false });

        if (beatsError) throw beatsError;
        setBeats(beatsData || []);

      } catch (error) {
        console.error('Error fetching producer data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducerData();
  }, [id]);

  // Filter beats based on key selection
  useEffect(() => {
    let filtered = [...beats];
    
    if (keyFilter && keyFilter !== 'all') {
      filtered = filtered.filter(beat => {
        const beatKey = beat.key;
        return beatKey === keyFilter;
      });
    }
    
    setFilteredBeats(filtered);
  }, [beats, keyFilter]);

  const handleAddToCart = async (item: BeatPack | Beat, type: 'beat_pack' | 'beat') => {
    await addToCart({
      item_type: type,
      item_id: item.id,
      quantity: 1,
      price_cents: type === 'beat' ? (item as Beat).price_cents : 0,
      title: type === 'beat' ? (item as Beat).title : (item as BeatPack).name,
      image_url: item.artwork_url || profile?.producer_logo_url,
      producer_name: profile?.producer_name
    });
  };

  const handlePlayPause = async (beat: Beat) => {
    if (currentTrack?.id === beat.id && isPlaying) {
      pauseTrack();
    } else {
      playTrack({
        id: beat.id,
        title: beat.title,
        artist: beat.artist || profile?.producer_name || 'Unknown',
        file_url: beat.audio_file_url,
        artwork_url: beat.artwork_url || profile?.producer_logo_url
      });
      
      // Track play count
      await trackPlay(beat.id);
    }
  };
  const handleFreeDownload = async (beat: Beat) => {
    try {
      const link = document.createElement('a');
      link.href = beat.audio_file_url;
      link.download = `${beat.title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await trackDownload(beat.id);
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <StickyHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-64 bg-muted rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <StickyHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Producer not found</h1>
            <p className="text-muted-foreground mt-2">This producer profile doesn't exist or has been removed.</p>
          </div>
        </div>
      </div>
    );
  }

  const profileUrl = `${window.location.origin}/${profile.username || `producer/${id}`}`;

  return (
    <div className="min-h-screen bg-background">
      <MetaTags
        title={`${profile.producer_name} - Producer | BeatPackz`}
        description={profile.bio || `Check out ${profile.producer_name}'s beats and production skills on BeatPackz`}
        image={profile.producer_logo_url || profile.banner_url}
        url={profileUrl}
      />
      
      <StickyHeader />
      
      {/* Hero Section */}
      <section className="relative h-96 bg-gradient-to-br from-primary/20 via-primary/10 to-background overflow-hidden">
        {profile.banner_url ? (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${profile.banner_url})` }}
          >
            <div className="absolute inset-0 bg-black/50" />
          </div>
        ) : (
          <>
            <video
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            >
              <source src="/assets/profile-fallback-video.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-12">
          <div className="flex items-end gap-6">
            <Avatar className="w-32 h-32 border-4 border-white shadow-lg">
              <AvatarImage src={profile.producer_logo_url} alt={profile.producer_name} />
              <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                {profile.producer_name?.charAt(0) || 'P'}
              </AvatarFallback>
            </Avatar>
            
            <div className="text-white space-y-2 flex-1">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-bold">{profile.producer_name}</h1>
                  {profile.verification_status === 'verified' && (
                    <img 
                      src={verifiedBadge} 
                      alt="Verified"
                      className="w-7 h-7"
                    />
                  )}
                </div>
                <div className="ml-auto">
                  <ShareProfile 
                    username={profile.username || `producer/${id}`} 
                    producerName={profile.producer_name} 
                  />
                </div>
              </div>
              
              {profile.home_town && (
                <div className="flex items-center gap-2 text-white/80">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.home_town}</span>
                </div>
              )}
              {profile.bio && (
                <p className="text-white/90 max-w-2xl">{profile.bio}</p>
              )}
              {profile.genres && profile.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {profile.genres.slice(0, 5).map((genre) => (
                    <Badge key={genre} variant="secondary" className="bg-white/20 text-white border-white/30">
                      {genre}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Beat Packs Section */}
        {beatPacks.length > 0 && (
          <section>
            <h2 className="text-3xl font-bold mb-8">Beat Packs</h2>
            <BeatPackGrid beatPacks={beatPacks} />
          </section>
        )}

        {/* Beats Section */}
        {beats.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold">All Beats</h2>
              
              {/* Filter Controls */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Key:</span>
                </div>
                <SortByKey 
                  value={keyFilter} 
                  onValueChange={setKeyFilter}
                  className="w-[140px]"
                />
                <div className="text-sm text-muted-foreground">
                  {filteredBeats.length} of {beats.length} beats
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              {filteredBeats.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-semibold text-muted-foreground">No beats found</h3>
                  <p className="text-muted-foreground mt-2">
                    {keyFilter ? `No beats found in key "${keyFilter}"` : 'No beats available'}
                  </p>
                </div>
              ) : (
                filteredBeats.map((beat, index) => (
                <Card key={beat.id} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="w-8 text-center text-muted-foreground font-mono">
                        {index + 1}
                      </div>

                      {/* Play Button */}
                      <CompactWaveformPlayer
                        track={{
                          id: beat.id,
                          title: beat.title,
                          file_url: beat.file_url || beat.audio_file_url,
                          audio_file_url: beat.audio_file_url
                        }}
                        isPlaying={currentTrack?.id === beat.id && isPlaying}
                        onPlay={() => handlePlayPause(beat)}
                        onPause={() => handlePlayPause(beat)}
                        className="w-50"
                      />

                      {/* Artwork */}
                      <div className="w-16 h-16 rounded overflow-hidden bg-muted">
                        {beat.artwork_url || profile.producer_logo_url ? (
                          <img 
                            src={beat.artwork_url || profile.producer_logo_url} 
                            alt={beat.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                            <div className="text-sm font-bold text-primary">
                              {beat.title.charAt(0)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Beat Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{beat.title}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          {beat.artist || profile.producer_name}
                          {profile.verification_status === 'verified' && (
                            <img 
                              src={verifiedBadge} 
                              alt="Verified"
                              className="w-3 h-3"
                            />
                          )}
                        </p>
                      </div>

                      {/* Beat Details */}
                      <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                        {(beat.manual_bpm || beat.detected_bpm || beat.bpm) && (
                          <span>{beat.manual_bpm || beat.detected_bpm || beat.bpm} BPM</span>
                        )}
                        {(beat.manual_key || beat.detected_key || beat.key) && (
                          <span>{beat.manual_key || beat.detected_key || beat.key}</span>
                        )}
                        {beat.genre && <Badge variant="secondary">{beat.genre}</Badge>}
                      </div>

                      {/* Stats */}
                      <div className="hidden lg:flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{beat.play_count} plays</span>
                        <span>{beat.download_count} downloads</span>
                      </div>

                      {/* Price & Actions */}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {beat.is_free ? 'Free download' : formatPrice(beat.price_cents)}
                        </span>
                        
                        {beat.is_free && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleFreeDownload(beat)}
                            aria-label="Download free beat"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleAddToCart(beat, 'beat')}
                          aria-label="Add to cart"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Tags */}
                    {beat.tags && beat.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3 ml-20">
                        {beat.tags.slice(0, 5).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )))}
            </div>
          </section>
        )}

        {beatPacks.length === 0 && beats.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold text-muted-foreground">No content available</h3>
            <p className="text-muted-foreground mt-2">This producer hasn't uploaded any beat packs or beats yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}