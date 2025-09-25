import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Bookmark, Share2, Play, Pause, Repeat2, ShoppingCart, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAudio } from '@/contexts/AudioContext';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import verifiedBadge from '@/assets/verified-badge.png';
import { FollowButton } from '@/components/ui/follow-button';

interface Beat {
  id: string;
  title: string;
  price_cents: number;
  is_free: boolean;
  artwork_url?: string;
  producer_id: string;
}

interface Post {
  id: string;
  producer_id: string;
  type: 'audio' | 'photo' | 'video';
  beat_id?: string;
  media_url: string;
  cover_url?: string;
  caption?: string;
  bpm?: number;
  key?: string;
  likes: number;
  comments: number;
  created_at: string;
  repost_of?: string;
  play_count?: number;
  producer: {
    producer_name: string;
    producer_logo_url?: string;
    verification_status?: string;
  };
  original_post?: {
    id: string;
    producer_id: string;
    type: 'audio' | 'photo' | 'video';
    beat_id?: string;
    media_url: string;
    cover_url?: string;
    caption?: string;
    bpm?: number;
    key?: string;
    created_at: string;
    play_count?: number;
    producer: {
      producer_name: string;
      producer_logo_url?: string;
      verification_status?: string;
    };
  };
}

interface FeedPostProps {
  post: Post;
  isVisible: boolean;
  currentUser?: any;
  onLike: (postId: string, isLiked: boolean) => void;
  onComment: (postId: string) => void;
  onSave: (postId: string, isSaved: boolean) => void;
  onShare: (postId: string) => void;
  onRepost: (postId: string) => void;
  repostCount?: number;
  slim?: boolean;
}

export function FeedPost({ 
  post, 
  isVisible, 
  currentUser, 
  onLike, 
  onComment, 
  onSave, 
  onShare,
  onRepost,
  repostCount = 0,
  slim = false
}: FeedPostProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [beatData, setBeatData] = useState<Beat | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTrack, playTrack, pauseTrack, isPlaying: globalIsPlaying } = useAudio();
  const { addToCart } = useCart();

  // Determine which post to display (original if repost)
  const displayPost = post.original_post || post;
  const isRepost = !!post.repost_of;

  const getFallbackImage = () => {
    if (displayPost.cover_url) return displayPost.cover_url;
    return displayPost.producer.producer_logo_url || '/placeholder.svg';
  };
  import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Bookmark, Share2, Play, Pause, Repeat2, ShoppingCart, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAudio } from '@/contexts/AudioContext';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import verifiedBadge from '@/assets/verified-badge.png';
import { FollowButton } from '@/components/ui/follow-button';

interface Beat {
  id: string;
  title: string;
  price_cents: number;
  is_free: boolean;
  artwork_url?: string;
  producer_id: string;
}

interface Post {
  id: string;
  producer_id: string;
  type: 'audio' | 'photo' | 'video';
  beat_id?: string;
  media_url: string;
  cover_url?: string;
  caption?: string;
  bpm?: number;
  key?: string;
  likes: number;
  comments: number;
  created_at: string;
  repost_of?: string;
  play_count?: number;
  producer: {
    producer_name: string;
    producer_logo_url?: string;
    verification_status?: string;
  };
  original_post?: {
    id: string;
    producer_id: string;
    type: 'audio' | 'photo' | 'video';
    beat_id?: string;
    media_url: string;
    cover_url?: string;
    caption?: string;
    bpm?: number;
    key?: string;
    created_at: string;
    play_count?: number;
    producer: {
      producer_name: string;
      producer_logo_url?: string;
      verification_status?: string;
    };
  };
}

interface FeedPostProps {
  post: Post;
  isVisible: boolean;
  currentUser?: any;
  onLike: (postId: string, isLiked: boolean) => void;
  onComment: (postId: string) => void;
  onSave: (postId: string, isSaved: boolean) => void;
  onShare: (postId: string) => void;
  onRepost: (postId: string) => void;
  repostCount?: number;
  slim?: boolean;
}

export function FeedPost({ 
  post, 
  isVisible, 
  currentUser, 
  onLike, 
  onComment, 
  onSave, 
  onShare,
  onRepost,
  repostCount = 0,
  slim = false
}: FeedPostProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [beatData, setBeatData] = useState<Beat | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTrack, playTrack, pauseTrack, isPlaying: globalIsPlaying } = useAudio();
  const { addToCart } = useCart();

  // Determine which post to display (original if repost)
  const displayPost = post.original_post || post;
  const isRepost = !!post.repost_of;

  const getFallbackImage = () => {
    if (displayPost.cover_url) return displayPost.cover_url;
    return displayPost.producer.producer_logo_url || '/placeholder.svg';
  };
    const handleRepost = () => {
    if (!currentUser) return toast.error('Please sign in to repost');
    if (post.producer_id === currentUser.id) return toast.error('You cannot repost your own content');
    onRepost(post.repost_of || post.id);
  };

  const handlePurchaseOrDownload = async () => {
    if (!beatData) return;

    if (beatData.is_free) {
      if (!currentUser) return toast.error('Please sign in to download');
      toast.success('Free download started!');
      // TODO: Implement actual download functionality
    } else {
      if (!currentUser) return toast.error('Please sign in to purchase');
      await addToCart({
        item_type: 'beat',
        item_id: beatData.id,
        quantity: 1,
        price_cents: beatData.price_cents,
        title: beatData.title,
        image_url: beatData.artwork_url || getFallbackImage(),
        producer_name: displayPost.producer.producer_name
      });
    }
  };

  return (
    <div className={`relative w-full ${slim ? 'max-w-md' : 'max-w-2xl'} h-full bg-background snap-start overflow-hidden rounded-lg sm:rounded-xl ${slim ? '' : 'mx-auto'} shadow-lg`}>
      {/* Background Media */}
      <div className="absolute inset-0 rounded-lg sm:rounded-xl overflow-hidden">
        {displayPost.type === 'video' ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            src={displayPost.media_url}
            loop
            muted={isMuted}
            playsInline
            poster={getFallbackImage()}
            onClick={handlePlayPause}
          />
        ) : displayPost.type === 'photo' ? (
          <div
            className="w-full h-full bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${displayPost.media_url}), url(${getFallbackImage()})` }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center relative">
            <div className="relative">
              <img
                src={getFallbackImage()}
                alt="Beat artwork"
                className="w-48 h-48 sm:w-64 sm:h-64 rounded-2xl object-cover shadow-2xl animate-pulse"
                style={{
                  animationDuration: isPlaying ? '2s' : '0s',
                  filter: isPlaying ? 'brightness(1.1) saturate(1.2)' : 'brightness(0.9)'
                }}
                onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
              />
              {isPlaying && (
                <div className="absolute inset-0 rounded-2xl border-4 border-white/30 animate-spin" style={{ animationDuration: '3s' }} />
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
      </div>

      {/* Play/Pause Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {(displayPost.type === 'audio' || (displayPost.type === 'photo' && displayPost.media_url.includes('.mp3'))) && (
          <Button
            variant="ghost"
            size="lg"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 pointer-events-auto hover:bg-white/30 transition-all hover:scale-110"
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-white" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white ml-0.5" />}
          </Button>
        )}
      </div>

      {displayPost.type === 'video' && (
        <div className="absolute top-4 right-4 pointer-events-auto">
          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 hover:bg-black/70 transition-all"
            onClick={handleMuteToggle}
          >
            {isMuted ? (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </Button>
        </div>
      )}

      {/* Content Overlay */}
      <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-4 pointer-events-none">
        {/* Repost indicator */}
        {post.repost_of && (
          <div className="flex items-center gap-2 text-white/80 text-xs sm:text-sm mb-2 pointer-events-auto">
            <Repeat2 className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>{post.producer.producer_name} reposted</span>
          </div>
        )}

        {/* Producer info & play count */}
        <div className="flex items-start justify-between text-white pointer-events-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-white/50">
              <AvatarImage src={displayPost.producer.producer_logo_url} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{displayPost.producer.producer_name?.[0] || 'P'}</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <p className="font-semibold text-xs sm:text-sm">{displayPost.producer.producer_name}</p>
                {displayPost.producer.verification_status === 'verified' && (
                  <img src={verifiedBadge} alt="Verified" className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </div>
              <FollowButton targetUserId={displayPost.producer_id} currentUserId={currentUser?.id} targetUserName={displayPost.producer.producer_name} variant="outline" size="sm" />
            </div>
          </div>

          <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full text-xs text-white/90">
            <Play className="w-3 h-3" />
            <span>{displayPost.play_count || 0}</span>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex items-end justify-between gap-3 sm:gap-4">
          <div className="flex-1 text-white pointer-events-auto pr-2">
            <div className="flex items-center gap-3 sm:gap-4 text-xs text-white/80 mb-2">
              {displayPost.bpm && <span className="bg-black/30 px-2 py-1 rounded-full">{displayPost.bpm} BPM</span>}
              {displayPost.key && <span className="bg-black/30 px-2 py-1 rounded-full">Key: {displayPost.key}</span>}
            </div>
            {displayPost.caption && (
              <div className="text-xs sm:text-sm leading-relaxed">
                {showFullCaption ? (
                  <p onClick={() => setShowFullCaption(false)} className="cursor-pointer">{displayPost.caption}</p>
                ) : (
                  <p onClick={() => setShowFullCaption(true)} className="cursor-pointer line-clamp-2">
                    {displayPost.caption.length > 100 ? `${displayPost.caption.substring(0, 100)}...` : displayPost.caption}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 pointer-events-auto">
            {beatData && (
              <div className="flex flex-col items-center">
                <Button variant="ghost" size="sm" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 hover:bg-primary/30 transition-all hover:scale-110" onClick={handlePurchaseOrDownload}>
                  {beatData.is_free ? <Download className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> : <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
                </Button>
                <span className="text-xs text-white/80 mt-1">{beatData.is_free ? 'Free' : `$${(beatData.price_cents / 100).toFixed(2)}`}</span>
              </div>
            )}

            <div className="flex flex-col items-center">
              <Button variant="ghost" size="sm" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-110" onClick={handleLike}>
                <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
              </Button>
              <span className="text-xs text-white/80 mt-1">{post.likes || 0}</span>
            </div>

            <div className="flex flex-col items-center">
              <Button variant="ghost" size="sm" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-110" onClick={() => onComment(post.id)}>
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </Button>
              <span className="text-xs text-white/80 mt-1">{post.comments || 0}</span>
            </div>

            <div className="flex flex-col items-center">
              <Button variant="ghost" size="sm" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-110" onClick={handleRepost} disabled={post.producer_id === currentUser?.id}>
                <Repeat2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </Button>
              <span className="text-xs text-white/80 mt-1">{post.repost_of ? 1 : 0}</span>
            </div>

            <Button variant="ghost" size="sm" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-110" onClick={handleSave}>
              <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${isSaved ? 'fill-white text-white' : 'text-white'}`} />
            </Button>

            <Button variant="ghost" size="sm" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-110" onClick={() => onShare(post.id)}>
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
