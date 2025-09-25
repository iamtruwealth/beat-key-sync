import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FeedPost } from './FeedPost';
import { FeedMeBeatzPost } from './FeedMeBeatzPost';
import { PostUploadDialog } from './PostUploadDialog';
import { FeedCommentsDialog } from './FeedCommentsDialog';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAudio } from '@/contexts/AudioContext';

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
  repost_count?: number;
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
    producer: {
      producer_name: string;
      producer_logo_url?: string;
      verification_status?: string;
    };
  };
}

interface FeedContainerProps {
  producerId?: string; // If provided, show only this producer's posts
  feedType?: 'for-you' | 'following';
  currentUser?: any;
  showUploadButton?: boolean;
  useFeedMeBeatzPost?: boolean;
  slim?: boolean;
}

export function FeedContainer({
  producerId,
  showUploadButton = false,
  feedType = 'for-you',
  currentUser: passedCurrentUser,
  useFeedMeBeatzPost = false,
  slim = false
}: FeedContainerProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(passedCurrentUser);
  const [showUpload, setShowUpload] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string>('');
  const [selectedPostProducer, setSelectedPostProducer] = useState<any>(null);
  const [visiblePostIndex, setVisiblePostIndex] = useState(0);
  const [repostCounts, setRepostCounts] = useState<Record<string, number>>({});
  const observer = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentTrack, playTrack, pauseTrack } = useAudio();
  const lastControlRef = useRef<{ id: string | null; mode: 'audio' | 'video' | null }>({ id: null, mode: null });
  const lastIndexRef = useRef<number>(-1);
  const ratiosRef = useRef<Record<number, number>>({});

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUser({ ...user, ...profile });
      }
    };
    getCurrentUser();
  }, []);

  // Fetch posts and historical beats
  useEffect(() => {
    const fetchFeedContent = async () => {
      try {
        let postsQuery = supabase
          .from('posts')
          .select(`
            id,
            producer_id,
            type,
            beat_id,
            media_url,
            cover_url,
            caption,
            bpm,
            key,
            likes,
            comments,
            created_at,
            repost_of,
            producer:profiles!posts_producer_id_fkey(
              producer_name,
              producer_logo_url,
              verification_status
            )
          `);

        if (producerId) {
          postsQuery = postsQuery.eq('producer_id', producerId);
        }

        if (feedType === 'following' && currentUser) {
          const { data: followedUsers } = await supabase
            .from('follows')
            .select('followed_id')
            .eq('follower_id', currentUser.id);

          if (followedUsers && followedUsers.length > 0) {
            const followedIds = followedUsers.map((f: any) => f.followed_id);
            postsQuery = postsQuery.in('producer_id', followedIds);
          } else {
            setPosts([]);
            setLoading(false);
            return;
          }
        }

        let beatsQuery = supabase
          .from('beats')
          .select(`
            id,
            producer_id,
            title,
            file_url,
            artwork_url,
            bpm,
            key,
            genre,
            description,
            created_at,
            producer:profiles!beats_producer_id_fkey(
              producer_name,
              producer_logo_url,
              verification_status
            )
          `);

        if (producerId) {
          beatsQuery = beatsQuery.eq('producer_id', producerId);
        }

        const [postsResult, beatsResult] = await Promise.all([postsQuery, beatsQuery]);

        if (postsResult.error) throw postsResult.error;
        if (beatsResult.error) throw beatsResult.error;

        const normalizedBeats: Post[] = (beatsResult.data || []).map((beat: any) => ({
          id: beat.id,
          producer_id: beat.producer_id,
          type: 'audio' as const,
          beat_id: beat.id,
          media_url: beat.file_url,
          cover_url: beat.artwork_url,
          caption: beat.description || `${beat.title}${beat.genre ? ` • ${beat.genre}` : ''}`,
          bpm: beat.bpm,
          key: beat.key,
          likes: 0,
          comments: 0,
          created_at: beat.created_at,
          repost_count: 0,
          producer: Array.isArray(beat.producer) ? beat.producer[0] : beat.producer
        }));

        const normalizedPosts: Post[] = (postsResult.data || []).map((post: any) => {
          const normalizedPost: any = {
            ...post,
            repost_count: 0,
            producer: Array.isArray(post.producer) ? post.producer[0] : post.producer,
            original_post: undefined
          };
          return normalizedPost;
        });

        let allPosts = [...normalizedPosts, ...normalizedBeats];

        if (feedType === 'for-you') {
          allPosts = allPosts.sort((a, b) => {
            const aEngagement = (a.likes || 0) * 2 + (a.comments || 0) * 3;
            const bEngagement = (b.likes || 0) * 2 + (b.comments || 0) * 3;
            const aRecency = new Date(a.created_at).getTime();
            const bRecency = new Date(b.created_at).getTime();
            const aScore = aEngagement + (aRecency / 1000000);
            const bScore = bEngagement + (bRecency / 1000000);
            return bScore - aScore;
          });
        } else {
          allPosts = allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }

        const counts: Record<string, number> = {};
        allPosts.forEach(post => {
          if (post.repost_of) {
            counts[post.repost_of] = (counts[post.repost_of] || 0) + 1;
          }
        });
        setRepostCounts(counts);

        setPosts(allPosts);
      } catch (error) {
        console.error('Error fetching feed content:', error);
        toast.error('Failed to load feed');
      } finally {
        setLoading(false);
      }
    };

    fetchFeedContent();
  }, [producerId, feedType, currentUser]);

  // Set up intersection observer for auto-play
  useEffect(() => {
    const rootEl = containerRef.current;
    if (!rootEl) return;

    const options: IntersectionObserverInit = {
      root: rootEl,
      rootMargin: '0px',
      threshold: [0, 0.25, 0.5, 0.75, 1]
    };

    // Reset ratios when posts change
    ratiosRef.current = {};

    // Create observer and store it in ref
    observer.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const indexAttr = (entry.target as HTMLElement).getAttribute('data-index') || '0';
        const idx = parseInt(indexAttr, 10);
        ratiosRef.current[idx] = entry.intersectionRatio;
      });

      // Pick the index with highest visibility ratio
      let bestIdx = lastIndexRef.current;
      let bestRatio = -1;
      Object.entries(ratiosRef.current).forEach(([k, v]) => {
        const idx = parseInt(k, 10);
        const ratio = v as number;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestIdx = idx;
        }
      });

      if (bestIdx !== -1 && bestIdx !== lastIndexRef.current) {
        lastIndexRef.current = bestIdx;
        setVisiblePostIndex(bestIdx);
      }
    }, options);

    return () => {
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [posts]);

  // Centralized playback control when visible item changes
  useEffect(() => {
    const container = containerRef.current;
    const activePost = posts[visiblePostIndex];
    if (!container || !activePost) return;

    // Pause all non-active videos (do not reset currentTime)
    const nodes = Array.from(container.querySelectorAll('video')) as HTMLVideoElement[];
    nodes.forEach((video) => {
      const parent = video.closest('[data-index]') as HTMLElement | null;
      const idxAttr = parent?.getAttribute('data-index');
      const idxNum = idxAttr ? parseInt(idxAttr, 10) : -1;
      if (idxNum !== visiblePostIndex) {
        try {
          video.pause();
        } catch {}
        video.muted = true; // keep inactive videos muted
      }
    });

    const isAudioLike = activePost.type === 'audio' || (activePost.type === 'photo' && activePost.media_url?.toLowerCase().includes('.mp3'));

    if (activePost.type === 'video') {
      // Switch to video: pause global audio
      pauseTrack();
      const activeVideo = container.querySelector(`[data-index="${visiblePostIndex}"] video`) as HTMLVideoElement | null;
      if (activeVideo) {
        // ensure muted before attempting autoplay (browser requirement)
        activeVideo.muted = true;
        activeVideo.play().catch(() => {});
      }
      lastControlRef.current = { id: activePost.id, mode: 'video' };
    } else if (isAudioLike) {
      // Switch to audio-like post: stop any video at this index
      const activeVideo = container.querySelector(`[data-index="${visiblePostIndex}"] video`) as HTMLVideoElement | null;
      if (activeVideo) {
        try {
          activeVideo.pause();
        } catch {}
        activeVideo.muted = true;
      }

      // Avoid re-calling playTrack for the same post
      if (lastControlRef.current.id !== activePost.id || lastControlRef.current.mode !== 'audio') {
        playTrack({
          id: activePost.id,
          title: activePost.caption || `${activePost.producer.producer_name} Beat`,
          artist: activePost.producer.producer_name,
          file_url: activePost.media_url,
          artwork_url: activePost.cover_url || activePost.producer.producer_logo_url || '/placeholder.svg'
        });
        lastControlRef.current = { id: activePost.id, mode: 'audio' };
      }
    } else {
      // Neither audio nor video: pause global audio
      pauseTrack();
      lastControlRef.current = { id: activePost.id, mode: null };
    }
  }, [visiblePostIndex, posts, pauseTrack, playTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { pauseTrack(); } catch {}
      const container = containerRef.current;
      const nodes = container?.querySelectorAll('video');
      nodes?.forEach(v => {
        const vid = v as HTMLVideoElement;
        try { vid.pause(); } catch {}
      });
    };
  }, [pauseTrack]);

  const handleLike = async (postId: string, isLiked: boolean) => {
    setPosts(posts.map(post =>
      post.id === postId
        ? { ...post, likes: post.likes + (isLiked ? 1 : -1) }
        : post
    ));
  };

  const handleComment = (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (post) {
      setSelectedPostId(postId);
      setSelectedPostProducer(post.producer);
      setShowComments(true);
    }
  };

  const handleCommentAdded = (postId: string) => {
    setPosts(posts.map(post =>
      post.id === postId
        ? { ...post, comments: post.comments + 1 }
        : post
    ));
  };

  const handleSave = (postId: string, isSaved: boolean) => {
    toast.success(isSaved ? 'Post saved!' : 'Post unsaved');
  };

  const handleShare = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const shareUrl = `${window.location.origin}/post/${postId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Beat by ${post.producer.producer_name}`,
          text: post.caption || 'Check out this beat!',
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled share or error occurred
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  const handlePostUploaded = (newPost: Post) => {
    setPosts([newPost, ...posts]);
    setShowUpload(false);
    toast.success('Post uploaded successfully!');
  };

  const handleRepost = async (originalPostId: string) => {
    if (!currentUser) {
      toast.error('Please sign in to repost');
      return;
    }

    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          producer_id: currentUser.id,
          type: 'audio',
          media_url: '',
          repost_of: originalPostId,
          likes: 0,
          comments: 0
        });

      if (error) throw error;

      setRepostCounts(prev => ({
        ...prev,
        [originalPostId]: (prev[originalPostId] || 0) + 1
      }));

      toast.success('Post reposted to your feed!');
      window.location.reload();
    } catch (error) {
      console.error('Error reposting:', error);
      toast.error('Failed to repost');
    }
  };

  const focusPost = (index: number) => {
    try {
      setVisiblePostIndex(index);
      const el = containerRef.current?.querySelector(`[data-index="${index}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch {}
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-background text-center p-8">
        <h3 className="text-xl font-semibold text-muted-foreground mb-2">
          No posts yet
        </h3>
        <p className="text-muted-foreground mb-6">
          {producerId ? 'This producer isn\'t posted anything yet.' : 'Be the first to share your beats!'}
        </p>
        {showUploadButton && (
          <Button onClick={() => setShowUpload(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Upload Your First Post
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-x-hidden">
      {/* Upload Button - Fixed position */}
      {showUploadButton && (
        <Button
          onClick={() => setShowUpload(true)}
          className="fixed top-20 right-4 z-50 rounded-full w-12 h-12 p-0 shadow-lg"
          size="sm"
        >
          <Plus className="w-5 h-5" />
        </Button>
      )}

      {/* Posts Container */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll overflow-x-hidden snap-y snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {posts.map((post, index) => (
          <div
            key={post.id}
            data-index={index}
            ref={(el) => {
              // Observe each item once (only here) — observer is created in useEffect above
              if (el && observer.current) {
                observer.current.observe(el);

                // Ensure media (video/audio) starts muted to allow autoplay
                const videoEl = el.querySelector('video') as HTMLVideoElement | null;
                if (videoEl) {
                  videoEl.muted = true;
                  videoEl.setAttribute('playsinline', 'true');
                }
                const audioEl = el.querySelector('audio') as HTMLAudioElement | null;
                if (audioEl) {
                  // keep audio element muted initially — playTrack handles unmuting if needed
                  audioEl.muted = true;
                }
              }
            }}
            className={`w-screen h-[85vh] snap-start flex justify-start items-center px-0`}
          >
            {useFeedMeBeatzPost ? (
              <FeedMeBeatzPost
                post={post}
                isVisible={index === visiblePostIndex}
                currentUser={currentUser}
                onLike={handleLike}
                onComment={handleComment}
                onSave={handleSave}
                onShare={handleShare}
                onRepost={handleRepost}
                repostCount={repostCounts[post.id] || 0}
                onFocus={() => focusPost(index)}
              />
            ) : (
              <FeedPost
                post={post}
                isVisible={index === visiblePostIndex}
                currentUser={currentUser}
                onLike={handleLike}
                onComment={handleComment}
                onSave={handleSave}
                onShare={handleShare}
                onRepost={handleRepost}
                repostCount={repostCounts[post.id] || 0}
                slim={slim}
              />
            )}
          </div>
        ))}
      </div>

      {/* Upload Dialog */}
      <PostUploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        onPostUploaded={handlePostUploaded}
      />

      {/* Comments Dialog */}
      <FeedCommentsDialog
        open={showComments}
        onOpenChange={setShowComments}
        postId={selectedPostId}
        postProducer={selectedPostProducer}
        currentUser={currentUser}
        onCommentAdded={handleCommentAdded}
      />
    </div>
  );
}
