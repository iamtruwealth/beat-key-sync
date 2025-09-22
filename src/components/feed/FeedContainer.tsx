import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FeedPost } from './FeedPost';
import { FeedMeBeatzPost } from './FeedMeBeatzPost';
import { PostUploadDialog } from './PostUploadDialog';
import { FeedCommentsDialog } from './FeedCommentsDialog';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
}

export function FeedContainer({ 
  producerId, 
  showUploadButton = false,
  feedType = 'for-you', 
  currentUser: passedCurrentUser,
  useFeedMeBeatzPost = false
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
        // Fetch posts with repost information
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

        // Filter by producer if specified
        if (producerId) {
          postsQuery = postsQuery.eq('producer_id', producerId);
        }

        // Filter by following if feedType is 'following'
        if (feedType === 'following' && currentUser) {
          // Get list of followed users
          const { data: followedUsers } = await supabase
            .from('follows')
            .select('followed_id')
            .eq('follower_id', currentUser.id);
          
          if (followedUsers && followedUsers.length > 0) {
            const followedIds = followedUsers.map(f => f.followed_id);
            postsQuery = postsQuery.in('producer_id', followedIds);
          } else {
            // If not following anyone, return empty array
            setPosts([]);
            setLoading(false);
            return;
          }
        }

        // Fetch beats as historical posts
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

        // Filter by producer if specified
        if (producerId) {
          beatsQuery = beatsQuery.eq('producer_id', producerId);
        }

        const [postsResult, beatsResult] = await Promise.all([
          postsQuery,
          beatsQuery
        ]);

        if (postsResult.error) throw postsResult.error;
        if (beatsResult.error) throw beatsResult.error;

        // Transform beats into post format
        const normalizedBeats: Post[] = (beatsResult.data || []).map(beat => ({
          id: beat.id,
          producer_id: beat.producer_id,
          type: 'audio' as const,
          beat_id: beat.id,
          media_url: beat.file_url,
          cover_url: beat.artwork_url,
          caption: beat.description || `${beat.title}${beat.genre ? ` • ${beat.genre}` : ''}`,
          bpm: beat.bpm,
          key: beat.key,
          likes: 0, // Historical beats start with 0 likes in feed context
          comments: 0,
          created_at: beat.created_at,
          repost_count: 0,
          producer: Array.isArray(beat.producer) ? beat.producer[0] : beat.producer
        }));

        // Ensure posts also have proper producer format
        const normalizedPosts: Post[] = (postsResult.data || []).map((post: any) => {
          const normalizedPost: any = {
            ...post,
            repost_count: 0, // Will be calculated below
            producer: Array.isArray(post.producer) ? post.producer[0] : post.producer,
            original_post: undefined // For now, we'll handle reposts later
          };

          return normalizedPost;
        });

        // Combine and sort posts
        let allPosts = [...normalizedPosts, ...normalizedBeats];
        
        if (feedType === 'for-you') {
          // Sort by trending algorithm (engagement score + recency)
          allPosts = allPosts.sort((a, b) => {
            const aEngagement = (a.likes || 0) * 2 + (a.comments || 0) * 3;
            const bEngagement = (b.likes || 0) * 2 + (b.comments || 0) * 3;
            const aRecency = new Date(a.created_at).getTime();
            const bRecency = new Date(b.created_at).getTime();
            
            // Weight recent posts higher, but also consider engagement
            const aScore = aEngagement + (aRecency / 1000000); // Normalize timestamp
            const bScore = bEngagement + (bRecency / 1000000);
            
            return bScore - aScore;
          });
        } else {
          // Sort by creation date for following feed
          allPosts = allPosts.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }

        // Calculate repost counts
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
    if (!containerRef.current) return;

    const options = {
      root: containerRef.current,
      rootMargin: '0px',
      threshold: 0.7
    };

    observer.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-index') || '0');
          setVisiblePostIndex(index);
        }
      });
    }, options);

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [posts]);

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
          type: 'audio', // Reposts are treated as audio type
          media_url: '', // Empty for reposts since they reference original
          repost_of: originalPostId,
          likes: 0,
          comments: 0
        });

      if (error) throw error;

      // Update repost count locally
      setRepostCounts(prev => ({
        ...prev,
        [originalPostId]: (prev[originalPostId] || 0) + 1
      }));

      toast.success('Post reposted to your feed!');
      
      // Refresh the feed to show the new repost
      window.location.reload();
    } catch (error) {
      console.error('Error reposting:', error);
      toast.error('Failed to repost');
    }
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
          {producerId ? 'This producer hasn\'t posted anything yet.' : 'Be the first to share your beats!'}
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
                if (el && observer.current) {
                  observer.current.observe(el);
                }
              }}
              className="w-full h-[85vh] snap-start flex justify-center items-center px-4 sm:px-8"
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