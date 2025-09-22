import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortByKey } from '@/components/ui/sort-by-key';
import { Play, Download, ShoppingCart, Pause, TrendingUp, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useAudio } from '@/contexts/AudioContext';
import { useTrackPlay } from '@/hooks/useTrackPlay';
import { useTrackDownload } from '@/hooks/useTrackDownload';
import verifiedBadge from '@/assets/verified-badge.png';
import { BeatCard } from '@/components/beats/BeatCard';
import { BeatRow } from '@/components/beats/BeatRow';

interface Beat {
  id: string;
  title: string;
  artist: string;
  audio_file_url: string;
  file_url?: string;
  artwork_url: string;
  bpm: number;
  manual_bpm?: number;
  detected_bpm?: number;
  key: string;
  manual_key?: string;
  detected_key?: string;
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
    verification_status?: string;
  };
}

interface TopBeatsListProps {
  limit?: number;
  showFilters?: boolean;
}

interface FilterState {
  genre: string;
  bpm: string;
  sort: string;
  key: string;
}

export default function TopBeatsList({ limit = 20, showFilters = true }: TopBeatsListProps) {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [filteredBeats, setFilteredBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    genre: '',
    bpm: '',
    sort: 'popularity',
    key: 'all'
  });
  const { addToCart } = useCart();
  const { currentTrack, isPlaying, playTrack, pauseTrack } = useAudio();
  const { trackPlay } = useTrackPlay();
  const { trackDownload } = useTrackDownload();

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
            file_url,
            artwork_url,
            bpm,
            manual_bpm,
            detected_bpm,
            key,
            manual_key,
            detected_key,
            genre,
            tags,
            price_cents,
            play_count,
            download_count,
            is_free,
            producer_id,
            profiles!beats_producer_id_fkey(
              id,
              producer_name,
              producer_logo_url,
              verification_status
            )
          `);

        // Apply filters
        if (filters.genre) {
          query = query.eq('genre', filters.genre);
        }

        if (filters.bpm) {
          const [min, max] = filters.bpm.split('-').map(Number);
          if (max) {
            query = query.gte('bpm', min).lte('bpm', max);
          } else {
            query = query.gte('bpm', min);
          }
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
          case 'price':
            query = query.order('price_cents', { ascending: true });
            break;
          default:
            query = query.order('play_count', { ascending: false });
        }

        query = query.limit(limit);

        const { data, error } = await query;
        if (error) throw error;

        const formattedBeats = data?.map(beat => ({
          ...beat,
          // Ensure BPM uses fallback hierarchy
          bpm: beat.manual_bpm || beat.detected_bpm || beat.bpm,
          // Ensure key uses fallback hierarchy  
          key: beat.manual_key || beat.detected_key || beat.key,
          // Ensure audio URL fallback
          audio_file_url: beat.audio_file_url || beat.file_url,
          producer: Array.isArray(beat.profiles) ? beat.profiles[0] : beat.profiles
        })) || [];

        setBeats(formattedBeats);
      } catch (error) {
        console.error('Error fetching beats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopBeats();
  }, [limit, filters]);

  // Filter beats based on key selection
  useEffect(() => {
    let filtered = [...beats];
    
    if (filters.key && filters.key !== 'all') {
      filtered = filtered.filter(beat => {
        const beatKey = beat.manual_key || beat.detected_key || beat.key;
        return beatKey === filters.key;
      });
    }
    
    setFilteredBeats(filtered);
  }, [beats, filters.key]);

  const handlePlay = async (beat: Beat) => {
    if (currentTrack?.id === beat.id && isPlaying) {
      pauseTrack();
    } else {
      playTrack({
        id: beat.id,
        title: beat.title,
        artist: beat.artist || beat.producer?.producer_name || 'Unknown',
        file_url: beat.audio_file_url,
        artwork_url: beat.artwork_url || beat.producer?.producer_logo_url
      });
      
      // Track play count
      await trackPlay(beat.id);
    }
  };

  const handleDownload = async (beat: Beat) => {
    try {
      // Start file download
      const link = document.createElement('a');
      link.href = beat.audio_file_url;
      link.download = `${beat.title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Track download count
      await trackDownload(beat.id);
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  const handleAddToCart = async (beat: Beat) => {
    await addToCart({
      item_type: 'beat',
      item_id: beat.id,
      quantity: 1,
      price_cents: beat.price_cents,
      title: beat.title,
      image_url: beat.artwork_url || beat.producer?.producer_logo_url,
      producer_name: beat.producer?.producer_name
    });
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="space-y-8">
        {/* Header with filtering */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              Top Beats
            </h2>
          </div>
          
          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Sort by:</span>
                  <Select 
                    value={filters.sort} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, sort: value }))}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popularity">Popularity</SelectItem>
                      <SelectItem value="downloads">Downloads</SelectItem>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Key:</span>
                  <SortByKey 
                    value={filters.key} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, key: value }))}
                    className="w-[140px]"
                  />
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                {filteredBeats.length} of {beats.length} beats
              </div>
            </div>
          )}
        </div>

        {/* Beats List */}
        <div className="space-y-2">
          {filteredBeats.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold text-muted-foreground">No beats found</h3>
              <p className="text-muted-foreground mt-2">
                {filters.key && filters.key !== 'all' ? `No beats found in key "${filters.key}"` : 'No beats available'}
              </p>
            </div>
          ) : (
            filteredBeats.map((beat, index) => (
              <BeatRow
                key={beat.id}
                index={index + 1}
                title={beat.title}
                artworkUrl={beat.artwork_url || beat.producer?.producer_logo_url}
                producerName={beat.artist || beat.producer?.producer_name}
                verified={beat.producer?.verification_status === 'verified'}
                bpm={beat.bpm as number | null}
                keyText={(beat.manual_key || beat.detected_key || beat.key) as string | null}
                genre={beat.genre}
                playCount={beat.play_count}
                downloadCount={beat.download_count}
                isFree={beat.is_free}
                priceCents={beat.price_cents}
                isPlaying={currentTrack?.id === beat.id && isPlaying}
                onPlay={() => handlePlay(beat)}
                onDownload={() => handleDownload(beat)}
                onAddToCart={() => handleAddToCart(beat)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}