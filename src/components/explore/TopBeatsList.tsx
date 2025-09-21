import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Download, ShoppingCart, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useAudio } from '@/contexts/AudioContext';

interface Beat {
  id: string;
  title: string;
  artist: string;
  audio_file_url: string;
  artwork_url: string;
  bpm: number;
  key: string;
  genre: string;
  tags: string[];
  price_cents: number;
  play_count: number;
  download_count: number;
  is_free: boolean;
  producer: {
    id: string;
    producer_name: string;
    producer_logo_url: string;
  };
}

interface TopBeatsListProps {
  limit?: number;
  showFilters?: boolean;
}

export default function TopBeatsList({ limit = 20, showFilters = true }: TopBeatsListProps) {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    genre: '',
    bpm: '',
    sort: 'popularity'
  });
  const { addToCart } = useCart();
  const { currentTrack, isPlaying, playTrack, pauseTrack } = useAudio();

  useEffect(() => {
    const fetchTopBeats = async () => {
      try {
        let query = supabase
          .from('beats')
          .select(`
            id,
            title,
            artist,
            audio_file_url,
            artwork_url,
            bpm,
            key,
            genre,
            tags,
            price_cents,
            play_count,
            download_count,
            is_free,
            producer:profiles!beats_producer_id_fkey(
              id,
              producer_name,
              producer_logo_url
            )
          `);

        // Apply filters
        if (filters.genre) {
          query = query.eq('genre', filters.genre);
        }

        // Apply sorting
        switch (filters.sort) {
          case 'popularity':
            query = query.order('play_count', { ascending: false });
            break;
          case 'downloads':
            query = query.order('download_count', { ascending: false });
            break;
          case 'newest':
            query = query.order('created_at', { ascending: false });
            break;
          default:
            query = query.order('play_count', { ascending: false });
        }

        query = query.limit(limit);

        const { data, error } = await query;
        if (error) throw error;
        
        const formattedData = data?.map(beat => ({
          ...beat,
          producer: Array.isArray(beat.producer) ? beat.producer[0] : beat.producer
        })) || [];
        
        setBeats(formattedData);
      } catch (error) {
        console.error('Error fetching beats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopBeats();
  }, [filters, limit]);

  const handleAddToCart = async (beat: Beat) => {
    await addToCart({
      item_type: 'beat',
      item_id: beat.id,
      quantity: 1,
      price_cents: beat.price_cents,
      title: beat.title,
      image_url: beat.artwork_url,
      producer_name: beat.producer?.producer_name
    });
  };

  const handlePlayPause = (beat: Beat) => {
    if (currentTrack?.id === beat.id && isPlaying) {
      pauseTrack();
    } else {
      playTrack({
        id: beat.id,
        title: beat.title,
        artist: beat.artist || beat.producer?.producer_name || 'Unknown',
        file_url: beat.audio_file_url,
        artwork_url: beat.artwork_url
      });
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">Top Beats</h2>
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-4 animate-pulse">
                  <div className="w-16 h-16 bg-muted rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold">Top Beats</h2>
          <Button variant="outline">View All</Button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 mb-6">
            <select 
              value={filters.genre}
              onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value }))}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Genres</option>
              <option value="Hip Hop">Hip Hop</option>
              <option value="Trap">Trap</option>
              <option value="R&B">R&B</option>
              <option value="Pop">Pop</option>
              <option value="Electronic">Electronic</option>
            </select>

            <select 
              value={filters.sort}
              onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="popularity">Most Popular</option>
              <option value="downloads">Most Downloaded</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        )}

        <div className="space-y-2">
          {beats.map((beat, index) => (
            <Card key={beat.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="w-8 text-center text-muted-foreground font-mono">
                    {index + 1}
                  </div>

                  {/* Play Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePlayPause(beat)}
                    className="w-10 h-10 p-0"
                  >
                    {currentTrack?.id === beat.id && isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>

                  {/* Artwork */}
                  <div className="w-16 h-16 rounded overflow-hidden bg-muted">
                    {beat.artwork_url || beat.producer?.producer_logo_url ? (
                      <img 
                        src={beat.artwork_url || beat.producer?.producer_logo_url} 
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
                    <p className="text-sm text-muted-foreground">
                      {beat.artist || beat.producer?.producer_name || 'Unknown Artist'}
                    </p>
                  </div>

                  {/* Beat Details */}
                  <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{beat.bpm} BPM</span>
                    <span>{beat.key}</span>
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
                      {beat.is_free ? 'Free' : formatPrice(beat.price_cents)}
                    </span>
                    
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleAddToCart(beat)}
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
          ))}
        </div>
      </div>
    </section>
  );
}