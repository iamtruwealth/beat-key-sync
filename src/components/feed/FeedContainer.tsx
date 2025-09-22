import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FeedPost } from './FeedPost';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { PostUploadDialog } from './PostUploadDialog';
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

interface FeedContainerProps {
  producerId?: string; // If provided, show only this producer's posts
  showUploadButton?: boolean;
}

export function FeedContainer({ producerId, showUploadButton = false }: FeedContainerProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [visiblePostIndex, setVisiblePostIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);

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

  // Fetch posts
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        let query = supabase
          .from('posts')
          .select(`
            *,
            producer:profiles!posts_producer_id_fkey(
              producer_name,
              producer_logo_url,
              verification_status
            )
          `)
          .order('created_at', { ascending: false });

        // Filter by producer if specified
        if (producerId) {
          query = query.eq('producer_id', producerId);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        setPosts(data || []);
      } catch (error) {
        console.error('Error fetching posts:', error);
        toast.error('Failed to load posts');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [producerId]);

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
    // TODO: Open comment dialog/sheet
    toast.info('Comments feature coming soon!');
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
    <div className="relative w-full h-screen">
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
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
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
            className="w-full h-screen snap-start"
          >
            <FeedPost
              post={post}
              isVisible={index === visiblePostIndex}
              currentUser={currentUser}
              onLike={handleLike}
              onComment={handleComment}
              onSave={handleSave}
              onShare={handleShare}
            />
          </div>
        ))}
      </div>

      {/* Upload Dialog */}
      <PostUploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        onPostUploaded={handlePostUploaded}
      />
    </div>
  );
}