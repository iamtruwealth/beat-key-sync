import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Bookmark, Share2, Play, Pause } from 'lucide-react';
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
  producer: {
    producer_name: string;
    producer_logo_url?: string;
    verification_status?: string;
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
}

export function FeedPost({ 
  post, 
  isVisible, 
  currentUser, 
  onLike, 
  onComment, 
  onSave, 
  onShare 
}: FeedPostProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTrack, playTrack, pauseTrack, isPlaying: globalIsPlaying } = useAudio();

  // Get fallback image - beat pack artwork or producer profile
  const getFallbackImage = () => {
    if (post.cover_url) return post.cover_url;
    // TODO: Could add beat pack artwork lookup here if needed
    return post.producer.producer_logo_url || '/placeholder.svg';
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
    if (post.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(console.error);
    } else if (post.type === 'audio' && currentTrack?.id !== post.id) {
      // Auto-play audio posts when they become visible
      playTrack({
        id: post.id,
        title: post.caption || `${post.producer.producer_name} Beat`,
        artist: post.producer.producer_name,
        file_url: post.media_url,
        artwork_url: getFallbackImage()
      });
    }
  }, [isVisible, post.type, post.id, currentTrack?.id, globalIsPlaying, pauseTrack, playTrack, post.media_url, post.caption, post.producer.producer_name]);

  // Sync with global audio context
  useEffect(() => {
    if (currentTrack?.id === post.id) {
      setIsPlaying(globalIsPlaying);
    } else {
      setIsPlaying(false);
    }
  }, [currentTrack, globalIsPlaying, post.id]);

  const handlePlayPause = () => {
    if (post.type === 'audio' || (post.type === 'photo' && post.media_url)) {
      if (currentTrack?.id === post.id && globalIsPlaying) {
        pauseTrack();
      } else {
        playTrack({
          id: post.id,
          title: post.caption || `${post.producer.producer_name} Beat`,
          artist: post.producer.producer_name,
          file_url: post.media_url,
          artwork_url: getFallbackImage()
        });
      }
    } else if (post.type === 'video' && videoRef.current) {
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

  return (
    <div className="relative w-full h-screen bg-background snap-start overflow-hidden">
      {/* Background Media */}
      <div className="absolute inset-0">
        {post.type === 'video' ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            src={post.media_url}
            loop
            muted
            playsInline
            poster={getFallbackImage()}
            onClick={handlePlayPause}
          />
        ) : post.type === 'photo' ? (
          <div 
            className="w-full h-full bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${post.media_url}), url(${getFallbackImage()})` }}
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
      </div>

      {/* Play/Pause Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {(post.type === 'audio' || (post.type === 'photo' && post.media_url.includes('.mp3'))) && (
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
        {/* Top: Producer Info */}
        <div className="flex items-center gap-2 sm:gap-3 text-white pointer-events-auto">
          <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-white/50">
            <AvatarImage src={post.producer.producer_logo_url} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {post.producer.producer_name?.[0] || 'P'}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1">
            <p className="font-semibold text-xs sm:text-sm">{post.producer.producer_name}</p>
            {post.producer.verification_status === 'verified' && (
              <img 
                src={verifiedBadge} 
                alt="Verified" 
                className="w-4 h-4 sm:w-5 sm:h-5"
              />
            )}
          </div>
        </div>

        {/* Bottom: Content Info & Actions */}
        <div className="flex items-end justify-between gap-3 sm:gap-4">
          {/* Left: Content Info */}
          <div className="flex-1 text-white pointer-events-auto pr-2">
            {post.caption && (
              <p className="text-xs sm:text-sm mb-2 leading-relaxed line-clamp-3">{post.caption}</p>
            )}
            <div className="flex items-center gap-3 sm:gap-4 text-xs text-white/80">
              {post.bpm && <span className="bg-black/30 px-2 py-1 rounded-full">{post.bpm} BPM</span>}
              {post.key && <span className="bg-black/30 px-2 py-1 rounded-full">Key: {post.key}</span>}
            </div>
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