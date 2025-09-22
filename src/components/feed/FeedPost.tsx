import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Bookmark, Share2, Play, Pause, Repeat2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAudio } from '@/contexts/AudioContext';
import { toast } from 'sonner';
import verifiedBadge from '@/assets/verified-badge.png';

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
  repostCount = 0
}: FeedPostProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTrack, playTrack, pauseTrack, isPlaying: globalIsPlaying } = useAudio();

  // Get the display post (original post if this is a repost, otherwise current post)
  const displayPost = post.original_post || post;
  const isRepost = !!post.repost_of;

  // Get fallback image - beat pack artwork or producer profile
  const getFallbackImage = () => {
    if (displayPost.cover_url) return displayPost.cover_url;
    // TODO: Could add beat pack artwork lookup here if needed
    return displayPost.producer.producer_logo_url || '/placeholder.svg';
  };

  // Check if user has liked/saved this post
  useEffect(() => {
    if (!currentUser) return;

    const checkUserInteractions = async () => {
      // Check if liked
      const { data: likeData } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      setIsLiked(!!likeData);

      // Check if saved
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

  // Auto-play based on visibility
  useEffect(() => {
    if (!isVisible) {
      // Pause everything when not visible
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (currentTrack?.id === post.id && globalIsPlaying) {
        pauseTrack();
      }
      return;
    }

    // Auto-play when visible
    if (displayPost.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(console.error);
    } else if (displayPost.type === 'audio' && currentTrack?.id !== displayPost.id) {
      // Auto-play audio posts when they become visible
      playTrack({
        id: displayPost.id,
        title: displayPost.caption || `${displayPost.producer.producer_name} Beat`,
        artist: displayPost.producer.producer_name,
        file_url: displayPost.media_url,
        artwork_url: getFallbackImage()
      });
    }
  }, [isVisible, displayPost.type, displayPost.id, currentTrack?.id, globalIsPlaying, pauseTrack, playTrack, displayPost.media_url, displayPost.caption, displayPost.producer.producer_name]);

  // Sync with global audio context
  useEffect(() => {
    if (currentTrack?.id === displayPost.id) {
      setIsPlaying(globalIsPlaying);
    } else {
      setIsPlaying(false);
    }
  }, [currentTrack, globalIsPlaying, displayPost.id]);

  const handlePlayPause = () => {
    if (displayPost.type === 'audio' || (displayPost.type === 'photo' && displayPost.media_url)) {
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

  const handleLike = async () => {
    if (!currentUser) {
      toast.error('Please sign in to like posts');
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: post.id, user_id: currentUser.id });
      }
      
      setIsLiked(!isLiked);
      onLike(post.id, !isLiked);
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      toast.error('Please sign in to save posts');
      return;
    }

    try {
      if (isSaved) {
        await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('post_saves')
          .insert({ post_id: post.id, user_id: currentUser.id });
      }
      
      setIsSaved(!isSaved);
      onSave(post.id, !isSaved);
    } catch (error) {
      console.error('Error toggling save:', error);
      toast.error('Failed to update save');
    }
  };

  const handleRepost = () => {
    if (!currentUser) {
      toast.error('Please sign in to repost');
      return;
    }

    if (post.producer_id === currentUser.id) {
      toast.error('You cannot repost your own content');
      return;
    }

    onRepost(isRepost ? post.repost_of! : post.id);
  };

  return (
    <div className="relative w-full h-screen bg-background snap-start overflow-hidden rounded-lg sm:rounded-none mx-0 sm:mx-0 my-0 sm:my-0">
      {/* Background Media */}
      <div className="absolute inset-0 rounded-lg sm:rounded-none overflow-hidden">
        {displayPost.type === 'video' ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            src={displayPost.media_url}
            loop
            muted
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
          // Audio post background
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
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
              {/* Vinyl record effect when playing */}
              {isPlaying && (
                <div className="absolute inset-0 rounded-2xl border-4 border-white/30 animate-spin" 
                     style={{ animationDuration: '3s' }} />
              )}
            </div>
            {/* Audio waveform effect */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </div>
        )}
        
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50" />
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
            {isPlaying ? (
              <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            ) : (
              <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white ml-0.5" />
            )}
          </Button>
        )}
      </div>

      {/* Content Overlay - Mobile Optimized */}
      <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-4 pointer-events-none">
        {/* Repost indicator */}
        {isRepost && (
          <div className="flex items-center gap-2 text-white/80 text-xs sm:text-sm mb-2 pointer-events-auto">
            <Repeat2 className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>{post.producer.producer_name} reposted</span>
          </div>
        )}
        
        {/* Top Section: Producer Info & Play Count */}
        <div className="flex items-start justify-between text-white pointer-events-auto">
          {/* Left: Producer Info & Follow Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-white/50">
              <AvatarImage src={displayPost.producer.producer_logo_url} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {displayPost.producer.producer_name?.[0] || 'P'}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <p className="font-semibold text-xs sm:text-sm">{displayPost.producer.producer_name}</p>
                {displayPost.producer.verification_status === 'verified' && (
                  <img 
                    src={verifiedBadge} 
                    alt="Verified" 
                    className="w-4 h-4 sm:w-5 sm:h-5"
                  />
                )}
              </div>
              {/* Follow Button - placeholder for now */}
              {currentUser && displayPost.producer_id !== currentUser.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  Follow
                </Button>
              )}
            </div>
          </div>
          
          {/* Right: Play Count */}
          <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full text-xs text-white/90">
            <Play className="w-3 h-3" />
            <span>{displayPost.play_count || 0}</span>
          </div>
        </div>

        {/* Bottom: Content Info & Actions */}
        <div className="flex items-end justify-between gap-3 sm:gap-4">
          {/* Left: Content Info */}
          <div className="flex-1 text-white pointer-events-auto pr-2">
            <div className="flex items-center gap-3 sm:gap-4 text-xs text-white/80 mb-2">
              {displayPost.bpm && <span className="bg-black/30 px-2 py-1 rounded-full">{displayPost.bpm} BPM</span>}
              {displayPost.key && <span className="bg-black/30 px-2 py-1 rounded-full">Key: {displayPost.key}</span>}
            </div>
            {displayPost.caption && (
              <div className="text-xs sm:text-sm leading-relaxed">
                {showFullCaption ? (
                  <p onClick={() => setShowFullCaption(false)} className="cursor-pointer">
                    {displayPost.caption}
                  </p>
                ) : (
                  <p 
                    onClick={() => setShowFullCaption(true)} 
                    className="cursor-pointer line-clamp-2"
                  >
                    {displayPost.caption.length > 100 
                      ? `${displayPost.caption.substring(0, 100)}...` 
                      : displayPost.caption
                    }
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: Action Buttons - Mobile Optimized */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 pointer-events-auto">
            <div className="flex flex-col items-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-110"
                onClick={handleLike}
              >
                <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
              </Button>
              <span className="text-xs text-white/80 mt-1">{post.likes}</span>
            </div>

            <div className="flex flex-col items-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-110"
                onClick={() => onComment(post.id)}
              >
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </Button>
              <span className="text-xs text-white/80 mt-1">{post.comments}</span>
            </div>

            <div className="flex flex-col items-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-110"
                onClick={handleRepost}
                disabled={post.producer_id === currentUser?.id}
              >
                <Repeat2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </Button>
              <span className="text-xs text-white/80 mt-1">{repostCount}</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-110"
              onClick={handleSave}
            >
              <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${isSaved ? 'fill-white text-white' : 'text-white'}`} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-110"
              onClick={() => onShare(post.id)}
            >
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}