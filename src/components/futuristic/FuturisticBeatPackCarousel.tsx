import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Play, Pause, Share2, ShoppingCart, Music } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { ScrollAnimationWrapper } from './ScrollAnimationWrapper';
import verifiedBadge from '@/assets/verified-badge.png';

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
    verification_status?: string;
  };
  track_count: number;
  sample_bpm?: number;
  sample_key?: string;
  total_price_cents: number;
  total_play_count: number;
}

export function FuturisticBeatPackCarousel() {
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingPackId, setPlayingPackId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const { addToCart } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    const fetchFeaturedBeatPacks = async () => {
      try {
        // Get featured beat packs first
        const { data: featured } = await supabase
          .from('featured_beat_packs')
          .select('beat_pack_id')
          .order('position', { ascending: true });

        let beatPacks = [];
        
        if (featured && featured.length > 0) {
          const ids = featured.map(f => f.beat_pack_id);
          const { data: packs } = await supabase
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
            .in('id', ids)
            .eq('is_public', true);
          
          beatPacks = ids.map(id => packs?.find(p => p.id === id)).filter(Boolean) as any[];
        } else {
          // Fallback to top beat packs by play count
          const { data: packs } = await supabase
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
            .eq('is_public', true)
            .order('play_count', { ascending: false })
            .limit(8);
          
          beatPacks = packs || [];
        }

        // Get beats data for each pack to calculate total price and play count
        const formattedData = await Promise.all(beatPacks.map(async (pack) => {
          const { data: packTracks } = await supabase
            .from('beat_pack_tracks')
            .select('track_id')
            .eq('beat_pack_id', pack.id);

          let totalPriceCents = 0;
          let totalPlayCount = 0;
          let sampleBpm = null;
          let sampleKey = null;

          if (packTracks && packTracks.length > 0) {
            const trackIds = packTracks.map(t => t.track_id);
            
            const { data: beats } = await supabase
              .from('beats')
              .select('price_cents, play_count, detected_bpm, manual_bpm, detected_key, manual_key')
              .in('id', trackIds);

            if (beats) {
              beats.forEach((beat) => {
                totalPriceCents += beat.price_cents || 0;
                totalPlayCount += beat.play_count || 0;
                
                if (!sampleBpm) {
                  sampleBpm = beat.manual_bpm || beat.detected_bpm;
                  sampleKey = beat.manual_key || beat.detected_key;
                }
              });
            }
          }
          
          return {
            ...pack,
            user: Array.isArray(pack.profiles) ? pack.profiles[0] : pack.profiles,
            track_count: pack.beat_pack_tracks?.[0]?.count || 0,
            sample_bpm: sampleBpm,
            sample_key: sampleKey,
            total_price_cents: totalPriceCents,
            total_play_count: totalPlayCount
          };
        }));

        setBeatPacks(formattedData);
      } catch (error) {
        console.error('Error fetching featured beat packs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedBeatPacks();
  }, []);

  const handlePlayPack = async (packId: string) => {
    if (playingPackId === packId) {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      setPlayingPackId(null);
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }

    try {
      const { data: firstTrack } = await supabase
        .from('beat_pack_tracks')
        .select('track_id')
        .eq('beat_pack_id', packId)
        .order('position', { ascending: true })
        .limit(1)
        .single();

      if (firstTrack) {
        const { data: beat } = await supabase
          .from('beats')
          .select('audio_file_url, title')
          .eq('id', firstTrack.track_id)
          .single();

        if (beat?.audio_file_url) {
          const audio = new Audio(beat.audio_file_url);
          setCurrentAudio(audio);
          
          audio.onplay = async () => {
            try {
              await supabase.rpc('increment_beat_play_count', { 
                beat_id: firstTrack.track_id 
              });
              
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

  const handleSharePack = async (pack: BeatPack) => {
    const shareUrl = `${window.location.origin}/pack/${pack.id}`;
    const shareText = `Check out "${pack.name}" by ${pack.user?.producer_name} on BeatPackz`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: pack.name,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Copied to clipboard",
          description: "Beat pack link has been copied to your clipboard.",
        });
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Copied to clipboard",
        description: "Beat pack link has been copied to your clipboard.",
      });
    }
  };

  const handleAddToCart = async (beatPack: BeatPack) => {
    await addToCart({
      item_type: 'beat_pack',
      item_id: beatPack.id,
      quantity: 1,
      price_cents: beatPack.total_price_cents,
      title: beatPack.name,
      image_url: beatPack.artwork_url,
      producer_name: beatPack.user?.producer_name
    });
  };

  if (loading) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="gradient-text">Featured</span>{" "}
              <span className="text-neon-magenta">Packs</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-80 glass-morphism rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/5 to-transparent" />
      
      <div className="container mx-auto px-6 relative z-10">
        <ScrollAnimationWrapper>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="gradient-text">Featured</span>{" "}
              <span className="text-neon-magenta">Beat Packs</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Curated collections from our top producers
            </p>
          </div>
        </ScrollAnimationWrapper>

        <Carousel
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {beatPacks.map((pack, index) => (
              <CarouselItem key={pack.id} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <ScrollAnimationWrapper animation="scale-in" delay={index * 100}>
                  <Card className="group glass-morphism border-2 border-border hover:border-neon-cyan transition-all duration-300 transform hover:scale-105 hover:-translate-y-2 overflow-hidden">
                    <div className="relative aspect-square">
                      {pack.artwork_url ? (
                        <img 
                          src={pack.artwork_url} 
                          alt={pack.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-neon-cyan/20 to-neon-magenta/20 flex items-center justify-center">
                          <div className="text-4xl font-bold text-neon-cyan opacity-50">
                            {pack.name.charAt(0)}
                          </div>
                        </div>
                      )}
                      
                      {/* Floating elements */}
                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-3 h-3 bg-neon-cyan rounded-full animate-float" />
                      </div>
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-2 h-2 bg-neon-magenta rounded-full animate-float" style={{ animationDelay: '0.5s' }} />
                      </div>
                      
                      {/* Overlay actions */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handlePlayPack(pack.id)}
                          className="bg-neon-cyan/20 backdrop-blur-sm border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-background neon-glow-hover"
                        >
                          {playingPackId === pack.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleSharePack(pack)}
                          className="bg-electric-blue/20 backdrop-blur-sm border border-electric-blue text-electric-blue hover:bg-electric-blue hover:text-background"
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleAddToCart(pack)}
                          className="bg-neon-magenta/20 backdrop-blur-sm border border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-background neon-glow-hover"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <CardContent className="p-6 space-y-4">
                      <Link to={`/pack/${pack.id}`}>
                        <h3 className="font-semibold text-lg hover:text-neon-cyan transition-colors group-hover:text-neon-cyan">
                          {pack.name}
                        </h3>
                      </Link>
                      
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-muted border border-electric-blue/30">
                          {pack.user?.producer_logo_url ? (
                            <img 
                              src={pack.user.producer_logo_url} 
                              alt={pack.user.producer_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-electric-blue/20 flex items-center justify-center text-xs font-bold text-electric-blue">
                              {pack.user?.producer_name?.charAt(0) || 'P'}
                            </div>
                          )}
                        </div>
                        <Link 
                          to={`/producer/${pack.user?.id}`}
                          className="text-sm text-muted-foreground hover:text-neon-cyan transition-colors flex items-center gap-1"
                        >
                          {pack.user?.producer_name || 'Unknown Producer'}
                          {pack.user?.verification_status === 'verified' && (
                            <img 
                              src={verifiedBadge} 
                              alt="Verified" 
                              className="w-3 h-3"
                            />
                          )}
                        </Link>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-1 text-electric-blue">
                          <Music className="w-4 h-4" />
                          <span>{pack.track_count} tracks</span>
                        </div>
                        {pack.genre && (
                          <span className="text-muted-foreground">{pack.genre}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neon-magenta">
                          {pack.total_play_count} plays
                        </span>
                        <div className="text-center">
                          <Button 
                            size="sm" 
                            onClick={() => handleAddToCart(pack)}
                            className="bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue-glow text-background neon-glow-hover"
                          >
                            ${(pack.total_price_cents / 100).toFixed(2)}
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1">buy pack</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </ScrollAnimationWrapper>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="glass-morphism border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-background" />
          <CarouselNext className="glass-morphism border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-background" />
        </Carousel>

        <ScrollAnimationWrapper className="text-center mt-12">
          <Link to="/beat-packs">
            <Button 
              size="lg"
              variant="outline"
              className="border-2 border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-background hover:shadow-lg hover:shadow-neon-magenta/30 transition-all duration-300 px-8 py-4 text-lg"
            >
              View All Beat Packs
            </Button>
          </Link>
        </ScrollAnimationWrapper>
      </div>
    </section>
  );
}