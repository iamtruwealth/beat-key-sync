import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Bookmark, Share2, Play, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAudio } from '@/contexts/AudioContext';
import { toast } from 'sonner';

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
        .single();
      
      setIsLiked(!!likeData);

      // Check if saved
      const { data: saveData } = await supabase
        .from('post_saves')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
        .single();
      
      setIsSaved(!!saveData);
    };

    checkUserInteractions();
  }, [currentUser, post.id]);

  // Auto-play/pause based on visibility
  useEffect(() => {
    if (post.type === 'video' && videoRef.current) {
      if (isVisible) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isVisible, post.type]);

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
          artwork_url: post.cover_url || post.producer.producer_logo_url
        });
      }
    } else if (post.type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
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
            onClick={handlePlayPause}
          />
        ) : post.type === 'photo' ? (
          <div 
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${post.media_url})` }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center relative">
            {post.cover_url && (
              <img 
                src={post.cover_url}
                alt="Beat artwork"
                className="w-64 h-64 rounded-lg object-cover shadow-2xl"
              />
            )}
            {/* Animated waveform overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
          </div>
        )}
        
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Play/Pause Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {(post.type === 'audio' || post.type === 'photo') && (
          <Button
            variant="ghost"
            size="lg"
            className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 pointer-events-auto hover:bg-white/30 transition-all"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </Button>
        )}
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
        {/* Top: Producer Info */}
        <div className="flex items-center gap-3 text-white pointer-events-auto">
          <Avatar className="w-10 h-10 border-2 border-white/50">
            <AvatarImage src={post.producer.producer_logo_url} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {post.producer.producer_name?.[0] || 'P'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{post.producer.producer_name}</p>
            {post.producer.verification_status === 'verified' && (
              <span className="text-xs text-white/80">✓ Verified</span>
            )}
          </div>
        </div>

        {/* Bottom: Content Info & Actions */}
        <div className="flex items-end justify-between gap-4">
          {/* Left: Content Info */}
          <div className="flex-1 text-white pointer-events-auto">
            {post.caption && (
              <p className="text-sm mb-2 leading-relaxed">{post.caption}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-white/80">
              {post.bpm && <span>{post.bpm} BPM</span>}
              {post.key && <span>Key: {post.key}</span>}
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-col items-center gap-4 pointer-events-auto">
            <Button
              variant="ghost"
              size="sm"
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all"
              onClick={handleLike}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
            </Button>
            <span className="text-xs text-white/80">{post.likes}</span>

            <Button
              variant="ghost"
              size="sm"
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all"
              onClick={() => onComment(post.id)}
            >
              <MessageCircle className="w-5 h-5 text-white" />
            </Button>
            <span className="text-xs text-white/80">{post.comments}</span>

            <Button
              variant="ghost"
              size="sm"
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all"
              onClick={handleSave}
            >
              <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-white text-white' : 'text-white'}`} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all"
              onClick={() => onShare(post.id)}
            >
              <Share2 className="w-5 h-5 text-white" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}