import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Download, ShoppingCart, Music } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Beat {
  id: string;
  title: string;
  description?: string;
  audio_file_url: string;
  artwork_url?: string;
  price_cents: number;
  is_free: boolean;
  genre?: string;
  bpm?: number;
  key?: string;
  tags?: string[];
  producer_id?: string;
  profiles?: {
    producer_name?: string;
    producer_logo_url?: string;
  };
}

interface BeatCardProps {
  beat: Beat;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  showPurchase?: boolean;
}

export function BeatCard({ 
  beat, 
  isPlaying = false, 
  onPlay, 
  onPause,
  showPurchase = true 
}: BeatCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const handlePurchase = async () => {
    if (!showPurchase) return;
    
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const buyerEmail = user?.email || prompt('Enter your email for purchase:');
      
      if (!buyerEmail) {
        toast.error('Email is required for purchase');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-beat-checkout', {
        body: {
          beatId: beat.id,
          buyerEmail,
        }
      });

      if (error) throw error;

      if (beat.is_free && data.downloadUrl) {
        // For free beats, trigger download
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = `${beat.title}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Beat downloaded successfully!');
      } else if (data.url) {
        // For paid beats, redirect to Stripe checkout
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Failed to process purchase. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Artwork */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
              {beat.artwork_url ? (
                <img 
                  src={beat.artwork_url} 
                  alt={beat.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            
            {/* Play/Pause Button Overlay */}
            <Button
              size="sm"
              variant="secondary"
              className="absolute inset-0 w-full h-full bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handlePlayPause}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Beat Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{beat.title}</h3>
            
            {beat.profiles?.producer_name && (
              <Link 
                to={`/producer/${beat.producer_id}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 block"
              >
                by {beat.profiles.producer_name}
              </Link>
            )}

            {beat.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {beat.description}
              </p>
            )}

            {/* Beat Details */}
            <div className="flex flex-wrap gap-2 mb-3">
              {beat.genre && (
                <Badge variant="secondary" className="text-xs">
                  {beat.genre}
                </Badge>
              )}
              {beat.bpm && (
                <Badge variant="outline" className="text-xs">
                  {beat.bpm} BPM
                </Badge>
              )}
              {beat.key && (
                <Badge variant="outline" className="text-xs">
                  {beat.key}
                </Badge>
              )}
            </div>

            {/* Tags */}
            {beat.tags && beat.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {beat.tags.slice(0, 3).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {beat.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{beat.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Price and Purchase */}
          {showPurchase && (
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                {beat.is_free ? (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    FREE
                  </Badge>
                ) : (
                  <div className="text-lg font-bold">
                    ${formatPrice(beat.price_cents)}
                  </div>
                )}
              </div>

              <Button
                size="sm"
                onClick={handlePurchase}
                disabled={isProcessing}
                className="min-w-[100px]"
              >
                {isProcessing ? (
                  'Processing...'
                ) : beat.is_free ? (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Buy Now
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}