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
  original_post?: Post;
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

  const displayPost = post.original_post || post;
  const isRepost = !!post.repost_of;

  const getFallbackImage = () => {
    if (displayPost.cover_url) return displayPost.cover_url;
    return displayPost.producer.producer_logo_url || '/placeholder.svg';
  };

  useEffect(() => {
    if (!currentUser) return;
    const checkUserInteractions = async () => {
      const { data: likeData } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      setIsLiked(!!likeData);

      const { data: saveData } = await supabase
        .from('post_saves')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      setIsSaved(!!saveData);
    };
    checkUserInteractions();
  }, [currentUser, post.id]);

  useEffect(() => {
    if (displayPost.beat_id) {
      const fetchBeatData = async () => {
        const { data, error } = await supabase
          .from('beats')
          .select('id, title, price_cents, is_free, artwork_url, producer_id')
          .eq('id', displayPost.beat_id)
          .maybeSingle();
        if (data && !error) setBeatData(data);
      };
      fetchBeatData();
    }
  }, [displayPost.beat_id]);
    // Auto-play and sync with visibility
  useEffect(() => {
    if (!isVisible) {
      if (videoRef.current) videoRef.current.pause();
      if (currentTrack?.id === displayPost.id && globalIsPlaying) pauseTrack();
      return;
    }

    if (displayPost.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(console.error);
    } else if (displayPost.type === 'audio' && currentTrack?.id !== displayPost.id) {
      playTrack({
        id: displayPost.id,
        title: displayPost.caption || `${displayPost.producer.producer_name} Beat`,
        artist: displayPost.producer.producer_name,
        file_url: displayPost.media_url,
        artwork_url: getFallbackImage()
      });
    }
  }, [
    isVisible,
    displayPost.type,
    displayPost.id,
    currentTrack?.id,
    globalIsPlaying,
    pauseTrack,
    playTrack,
    displayPost.media_url,
    displayPost.caption,
    displayPost.producer.producer_name
  ]);

  useEffect(() => {
    if (currentTrack?.id === displayPost.id) {
      setIsPlaying(globalIsPlaying);
    } else {
      setIsPlaying(false);
    }
  }, [currentTrack, globalIsPlaying, displayPost.id]);

  const handlePlayPause = () => {
    if (displayPost.type === 'audio' || (displayPost.type === 'photo' && displayPost.media_url.includes('.mp3'))) {
      if (currentTrack?.id === displayPost.id && globalIsPlaying) {
        pauseTrack();
      } else {
        playTrack({
          id: displayPost.id,
          title: displayPost.caption || `${displayPost.producer.producer_name} Beat`,
          artist: displayPost.producer.producer_name,
          file_url: displayPost.media_url,
          artwork_url: getFallbackImage()
        });
      }
    } else if (displayPost.type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current) videoRef.current.muted = !isMuted;
  };
    const handleLike = async () => {
    if (!currentUser) return toast.error('Please sign in to like posts');
    try {
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
      } else {
        await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUser.id });
      }
      setIsLiked(!isLiked);
      onLike(post.id, !isLiked);
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const handleSave = async () => {
    if (!currentUser) return toast.error('Please sign in to save posts');
    try {
      if (isSaved) {
        await supabase.from('post_saves').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
      } else {
        await supabase.from('post_saves').insert({ post_id: post.id, user_id: currentUser.id });
      }
      setIsSaved(!isSaved);
      onSave(post.id, !isSaved);
    } catch (error) {
      console.error('Error toggling save:', error);
      toast.error('Failed to update save');
    }
  };

  const handleRepost = () => {
    if (!currentUser) return toast.error('Please sign in to repost');
    if (post.producer_id === currentUser.id) return toast.error('You cannot repost your own content');
    onRepost(post.original_post ? post.repost_of! : post.id);
  };

  const handlePurchaseOrDownload = async () => {
    if (!beatData) return;
    if (beatData.is_free) {
      if (!currentUser) return toast.error('Please sign in to download');
      toast.success('Free download started!');
      // TODO: implement actual download
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
      {/* Media */}
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
            <img 
              src={getFallbackImage()}
              alt="Beat artwork"
              className="w-48 h-48 sm:w-64 sm:h-64 rounded-2xl object-cover shadow-2xl animate-pulse"
              style={{ animationDuration: isPlaying ? '2s' : '0s', filter: isPlaying ? 'brightness(1.1) saturate(1.2)' : 'brightness(0.9)' }}
              onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
            />
            {isPlaying && <div className="absolute inset-0 rounded-2xl border-4 border-white/30 animate-spin" style={{ animationDuration: '3s' }} />}
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

      {/* Mute Button */}
      {displayPost.type === 'video' && (
        <div className="absolute top-4 right-4 pointer-events-auto">
          <Button variant="ghost" size="sm" className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 hover:bg-black/70 transition-all" onClick={handleMuteToggle}>
            {isMuted ? '🔇' : '🔊'}
          </Button>
        </div>
      )}

      {/* Content & Actions */}
      <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-4 pointer-events-none">
        {/* Repost Indicator */}
        {post.repost_of && <div className="flex items-center gap-2 text-white/80 text-xs sm:text-sm mb-2 pointer-events-auto">Reposted</div>}
        
        {/* Bottom Actions */}
        <div className="flex items-end justify-between gap-3 sm:gap-4">
          <div className="flex-1 text-white pointer-events-auto pr-2">
            {displayPost.caption && (
              <p className="text-xs sm:text-sm leading-relaxed line-clamp-2">{displayPost.caption}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 pointer-events-auto">
            {beatData && (
              <Button variant="ghost" size="sm" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 hover:bg-primary/30 transition-all hover:scale-110" onClick={handlePurchaseOrDownload}>
                {beatData.is_free ? '⬇️' : '🛒'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLike}>{isLiked ? '❤️' : '🤍'}</Button>
            <Button variant="ghost" size="sm" onClick={() => onComment(post.id)}>💬</Button>
            <Button variant="ghost" size="sm" onClick={handleRepost}>🔁</Button>
            <Button variant="ghost" size="sm" onClick={handleSave}>{isSaved ? '🔖' : '📑'}</Button>
            <Button variant="ghost" size="sm" onClick={() => onShare(post.id)}>📤</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
