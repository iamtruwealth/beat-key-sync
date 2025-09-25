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
  original_post?: Post;
}

interface FeedContainerProps {
  producerId?: string;
  feedType?: 'for-you' | 'following';
  currentUser?: any;
  showUploadButton?: boolean;
  useFeedMeBeatzPost?: boolean;
  slim?: boolean;
  fullScreen?: boolean;
}

export function FeedContainer({
  producerId,
  showUploadButton = false,
  feedType = 'for-you',
  currentUser: passedCurrentUser,
  useFeedMeBeatzPost = false,
  slim = false,
  fullScreen = false
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
  const { playTrack, pauseTrack } = useFeedMeBeatzPost ? { playTrack: () => {}, pauseTrack: () => {} } : useAudio();
  const lastControlRef = useRef<{ id: string | null; mode: 'audio' | 'video' | null }>({ id: null, mode: null });
  const lastIndexRef = useRef<number>(-1);
  const ratiosRef = useRef<Record<number, number>>({});

  // Track manual play to avoid auto-pause
  const userPlayedRef = useRef<Record<string, boolean>>({});

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

  // Fetch posts and beats
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

        if (producerId) postsQuery = postsQuery.eq('producer_id', producerId);

        if (feedType === 'following' && currentUser) {
          const { data: followedUsers } = await supabase
            .from('follows')
            .select('followed_id')
            .eq('follower_id', currentUser.id);

          if (followedUsers?.length) {
            postsQuery = postsQuery.in('producer_id', followedUsers.map((f: any) => f.followed_id));
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

        if (producerId) beatsQuery = beatsQuery.eq('producer_id', producerId);

        const [postsResult, beatsResult] = await Promise.all([postsQuery, beatsQuery]);
        if (postsResult.error) throw postsResult.error;
        if (beatsResult.error) throw beatsResult.error;

        const normalizedBeats: Post[] = (beatsResult.data || []).map((beat: any) => ({
          id: beat.id,
          producer_id: beat.producer_id,
          type: 'audio',
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

        const normalizedPosts: Post[] = (postsResult.data || []).map((post: any) => ({
          ...post,
          repost_count: 0,
          producer: Array.isArray(post.producer) ? post.producer[0] : post.producer,
          original_post: undefined
        }));

        let allPosts = [...normalizedPosts, ...normalizedBeats];

        allPosts = feedType === 'for-you'
          ? allPosts.sort((a, b) => {
              const aEng = (a.likes || 0) * 2 + (a.comments || 0) * 3;
              const bEng = (b.likes || 0) * 2 + (b.comments || 0) * 3;
              const aScore = aEng + new Date(a.created_at).getTime() / 1000000;
              const bScore = bEng + new Date(b.created_at).getTime() / 1000000;
              return bScore - aScore;
            })
          : allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const counts: Record<string, number> = {};
        allPosts.forEach(post => {
          if (post.repost_of) counts[post.repost_of] = (counts[post.repost_of] || 0) + 1;
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

  // IntersectionObserver for auto-play
  useEffect(() => {
    const rootEl = containerRef.current;
    if (!rootEl) return;
    ratiosRef.current = {};

    observer.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const idx = parseInt(entry.target.getAttribute('data-index') || '0', 10);
        ratiosRef.current[idx] = entry.intersectionRatio;
      });

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
    }, { root: rootEl, threshold: [0, 0.25, 0.5, 0.75, 1] });

    return () => observer.current?.disconnect();
  }, [posts]);

  // Handle auto-play vs manual play - skip for FeedMeBeatz posts
  useEffect(() => {
    if (useFeedMeBeatzPost) return; // Let FeedMeBeatzPost handle its own audio
    
    const container = containerRef.current;
    const activePost = posts[visiblePostIndex];
    if (!container || !activePost) return;

    const nodes = Array.from(container.querySelectorAll('video')) as HTMLVideoElement[];
    nodes.forEach(video => {
      const idxAttr = video.closest('[data-index]')?.getAttribute('data-index');
      const idxNum = idxAttr ? parseInt(idxAttr, 10) : -1;
      const postId = posts[idxNum]?.id;
      if (idxNum !== visiblePostIndex && !userPlayedRef.current[postId]) {
        video.pause();
        video.muted = true;
      }
    });

    const isAudioLike = activePost.type === 'audio' || (activePost.type === 'photo' && activePost.media_url?.includes('.mp3'));

    if (activePost.type === 'video') {
      pauseTrack();
      const activeVideo = container.querySelector(`[data-index="${visiblePostIndex}"] video`) as HTMLVideoElement | null;
      if (activeVideo) {
        activeVideo.muted = true;
        activeVideo.play().catch(() => {});
      }
      lastControlRef.current = { id: activePost.id, mode: 'video' };
    } else if (isAudioLike) {
      const activeVideo = container.querySelector(`[data-index="${visiblePostIndex}"] video`) as HTMLVideoElement | null;
      if (activeVideo) {
        activeVideo.pause();
        activeVideo.currentTime = 0;
      }
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
      pauseTrack();
      lastControlRef.current = { id: activePost.id, mode: null };
    }
  }, [visiblePostIndex, posts, pauseTrack, playTrack, useFeedMeBeatzPost]);

  // Manual play handler
  const handleManualPlay = (postId: string) => {
    userPlayedRef.current[postId] = true;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { pauseTrack(); } catch {}
      const container = containerRef.current;
      container?.querySelectorAll('video').forEach(v => {
        v.pause();
        v.currentTime = 0;
      });
    };
  }, [pauseTrack]);

  // --- remaining handlers like handleLike, handleComment, handleShare, handlePostUploaded etc ---
  // Keep your existing handlers here; they don’t change.

  return (
    <div className="relative w-full h-full overflow-x-hidden">
      {/* Upload Button */}
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
            className={`w-screen ${fullScreen ? 'h-screen' : 'h-[85vh]'} snap-start flex justify-start items-center px-0`}
          >
            {useFeedMeBeatzPost ? (
              <FeedMeBeatzPost
                post={post}
                isVisible={index === visiblePostIndex}
                currentUser={currentUser}
                onLike={() => {}}
                onComment={() => {}}
                onSave={() => {}}
                onShare={() => {}}
                onRepost={() => {}}
                repostCount={repostCounts[post.id] || 0}
                onFocus={() => setVisiblePostIndex(index)}
              />
            ) : (
              <FeedPost
                post={post}
                isVisible={index === visiblePostIndex}
                currentUser={currentUser}
                onLike={() => {}}
                onComment={() => {}}
                onSave={() => {}}
                onShare={() => {}}
                onRepost={() => {}}
                repostCount={repostCounts[post.id] || 0}
                slim={slim}
              />
            )}
          </div>
        ))}
      </div>

      {/* Dialogs */}
      <PostUploadDialog open={showUpload} onOpenChange={setShowUpload} onPostUploaded={(p) => setPosts([p, ...posts])} />
      <FeedCommentsDialog open={showComments} onOpenChange={setShowComments} postId={selectedPostId} postProducer={selectedPostProducer} currentUser={currentUser} onCommentAdded={() => {}} />
    </div>
  );
}
