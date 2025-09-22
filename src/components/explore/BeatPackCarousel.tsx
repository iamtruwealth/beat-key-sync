import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Play, Share2, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';

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
  };
  track_count: number;
  sample_bpm?: number;
  sample_key?: string;
  total_price_cents: number;
  total_play_count: number;
}

export default function BeatPackCarousel() {
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingPackId, setPlayingPackId] = useState<string | null>(null);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchTopBeatPacks = async () => {
      try {
        const { data, error } = await supabase
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
              producer_logo_url
            ),
            beat_pack_tracks(count)
          `)
          .eq('is_public', true)
          .order('play_count', { ascending: false })
          .limit(10);

        if (error) throw error;

        // Get beats data for each pack to calculate total price and play count
        const formattedData = await Promise.all((data || []).map(async (pack) => {
          // First get the track IDs in this pack
          const { data: packTracks } = await supabase
            .from('beat_pack_tracks')
            .select('track_id')
            .eq('beat_pack_id', pack.id);

          let totalPriceCents = 0;
          let totalPlayCount = 0;
          let sampleBpm = null;
          let sampleKey = null;

          if (packTracks && packTracks.length > 0) {
            // Get beat information for each track
            const trackIds = packTracks.map(t => t.track_id);
            
            const { data: beats } = await supabase
              .from('beats')
              .select('price_cents, play_count, detected_bpm, manual_bpm, detected_key, manual_key')
              .in('id', trackIds);

            if (beats) {
              beats.forEach((beat) => {
                totalPriceCents += beat.price_cents || 0;
                totalPlayCount += beat.play_count || 0;
                
                // Use first beat for sample BPM/key
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
        console.error('Error fetching beat packs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopBeatPacks();
  }, []);

  const handlePlayPack = async (packId: string) => {
    if (playingPackId === packId) {
      setPlayingPackId(null);
      return;
    }

    try {
      // Get the first track in the pack
      const { data: firstTrack } = await supabase
        .from('beat_pack_tracks')
        .select('track_id')
        .eq('beat_pack_id', packId)
        .order('position', { ascending: true })
        .limit(1)
        .single();

      if (firstTrack) {
        // Get the beat data for the first track
        const { data: beat } = await supabase
          .from('beats')
          .select('audio_file_url, title')
          .eq('id', firstTrack.track_id)
          .single();

        if (beat?.audio_file_url) {
          // Create and play audio
          const audio = new Audio(beat.audio_file_url);
          audio.play();
          setPlayingPackId(packId);
          
          audio.onended = () => setPlayingPackId(null);
          audio.onerror = () => setPlayingPackId(null);
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
        // User cancelled sharing, fall back to clipboard
        await navigator.clipboard.writeText(shareUrl);
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareUrl);
      // You could add a toast notification here
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
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">Top Beat Packs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-square bg-muted animate-pulse" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold">Top Beat Packs</h2>
          <Link to="/beat-packs">
            <Button variant="outline">View All</Button>
          </Link>
        </div>

        <Carousel
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {beatPacks.map((pack) => (
              <CarouselItem key={pack.id} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className="relative aspect-square">
                    {pack.artwork_url ? (
                      <img 
                        src={pack.artwork_url} 
                        alt={pack.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                        <div className="text-4xl font-bold text-primary opacity-50">
                          {pack.name.charAt(0)}
                        </div>
                      </div>
                    )}
                    
                    {/* Overlay actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handlePlayPack(pack.id)}>
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleSharePack(pack)}>
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleAddToCart(pack)}>
                        <ShoppingCart className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <Link to={`/pack/${pack.id}`}>
                      <h3 className="font-semibold hover:text-primary transition-colors">
                        {pack.name}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-muted">
                        {pack.user?.producer_logo_url ? (
                          <img 
                            src={pack.user.producer_logo_url} 
                            alt={pack.user.producer_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {pack.user?.producer_name?.charAt(0) || 'P'}
                          </div>
                        )}
                      </div>
                      <Link 
                        to={`/producer/${pack.user?.id}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {pack.user?.producer_name || 'Unknown Producer'}
                      </Link>
                    </div>
                    
                     <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                       <span>{pack.track_count} tracks</span>
                       {pack.genre && <span>{pack.genre}</span>}
                     </div>
                     
                     <div className="flex items-center justify-between mt-3">
                       <span className="text-sm font-medium">{pack.total_play_count} plays</span>
                       <div className="text-center">
                         <Button size="sm" onClick={() => handleAddToCart(pack)}>
                           ${(pack.total_price_cents / 100).toFixed(2)}
                         </Button>
                         <p className="text-xs text-muted-foreground mt-1">buy whole pack</p>
                       </div>
                     </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </section>
  );
}