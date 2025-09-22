import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Pause, Share2, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';

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

interface BeatPackCardProps {
  pack: BeatPack;
  playingPackId: string | null;
  currentAudio: HTMLAudioElement | null;
  onPlay: (packId: string) => void;
}

export default function BeatPackCard({ pack, playingPackId, currentAudio, onPlay }: BeatPackCardProps) {
  const { addToCart } = useCart();
  const { toast } = useToast();

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
        toast({
          title: "Copied to clipboard",
          description: "Beat pack link has been copied to your clipboard.",
        });
      }
    } else {
      // Fallback to clipboard
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

  return (
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
          <Button size="sm" variant="secondary" onClick={() => onPlay(pack.id)}>
            {playingPackId === pack.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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
  );
}