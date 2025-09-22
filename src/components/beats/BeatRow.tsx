import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Download, ShoppingCart } from 'lucide-react';
import verifiedBadge from '@/assets/verified-badge.png';

interface BeatRowProps {
  index: number;
  title: string;
  artworkUrl?: string;
  producerName?: string;
  verified?: boolean;
  bpm?: number | null;
  keyText?: string | null;
  genre?: string | null;
  playCount?: number | null;
  downloadCount?: number | null;
  isFree: boolean;
  priceCents: number;
  isPlaying: boolean;
  onPlay: () => void;
  onDownload: () => void;
  onAddToCart: () => void;
}

export function BeatRow({
  index,
  title,
  artworkUrl,
  producerName,
  verified,
  bpm,
  keyText,
  genre,
  playCount,
  downloadCount,
  isFree,
  priceCents,
  isPlaying,
  onPlay,
  onDownload,
  onAddToCart,
}: BeatRowProps) {
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-4 min-w-0 flex-nowrap">
          {/* Rank */}
          <div className="w-8 text-center text-muted-foreground font-mono shrink-0">
            {index}
          </div>

          {/* Play Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onPlay}
            className="w-12 h-12 rounded-full hover:bg-primary/10 shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </Button>

          {/* Artwork with Play Overlay */}
          <div className="relative w-16 h-16 rounded overflow-hidden bg-muted group/artwork cursor-pointer shrink-0" onClick={onPlay}>
            {artworkUrl ? (
              <img src={artworkUrl} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <div className="text-sm font-bold text-primary">
                  {title.charAt(0)}
                </div>
              </div>
            )}

            {/* Elegant Play/Pause Overlay */}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/artwork:opacity-100 transition-all duration-300">
              <div className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transform scale-75 group-hover/artwork:scale-100 transition-transform duration-300 shadow-lg">
                {isPlaying ? (
                  <Pause className="w-4 h-4 text-black ml-0" />
                ) : (
                  <Play className="w-4 h-4 text-black ml-0.5" />
                )}
              </div>
            </div>
          </div>

          {/* Beat Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{title}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
              {producerName}
              {verified && (
                <img src={verifiedBadge} alt="Verified" className="w-3 h-3" />
              )}
            </p>
          </div>

          {/* Beat Details */}
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            {bpm ? <span>{bpm} BPM</span> : null}
            {keyText ? <span>{keyText}</span> : null}
            {genre ? <Badge variant="secondary">{genre}</Badge> : null}
          </div>

          {/* Stats */}
          <div className="hidden lg:flex items-center gap-4 text-sm text-muted-foreground">
            <span>{playCount || 0} plays</span>
            <span>{downloadCount || 0} downloads</span>
          </div>

        {/* Price & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-semibold whitespace-nowrap">
            {isFree ? 'Free download' : formatPrice(priceCents)}
          </span>
          {isFree && (
            <Button variant="ghost" size="sm" onClick={onDownload} aria-label="Download free beat">
              <Download className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onAddToCart} aria-label="Add to cart">
            <ShoppingCart className="w-4 h-4" />
          </Button>
        </div>
        </div>
      </CardContent>
    </Card>
  );
}
