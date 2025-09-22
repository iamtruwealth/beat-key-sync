import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import verifiedBadge from '@/assets/verified-badge.png';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  post_id: string;
  user: {
    producer_name: string;
    producer_logo_url?: string;
    verification_status?: string;
  };
}

interface FeedCommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postProducer: {
    producer_name: string;
    producer_logo_url?: string;
  };
  currentUser?: any;
  onCommentAdded: (postId: string) => void;
}

export function FeedCommentsDialog({
  open,
  onOpenChange,
  postId,
  postProducer,
  currentUser,
  onCommentAdded
}: FeedCommentsDialogProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && postId) {
      fetchComments();
    }
  }, [open, postId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          post_id,
          profiles!post_comments_user_id_fkey(
            producer_name,
            producer_logo_url,
            verification_status
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform the data to match our Comment interface
      const transformedComments = (data || []).map(comment => ({
        ...comment,
        user: Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles
      }));

      setComments(transformedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast.error('Please sign in to comment');
      return;
    }

    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          content: newComment.trim()
        })
        .select(`
          id,
          content,
          created_at,
          user_id,
          post_id,
          profiles!post_comments_user_id_fkey(
            producer_name,
            producer_logo_url,
            verification_status
          )
        `)
        .single();

      if (error) throw error;

      // Transform the data to match our Comment interface
      const transformedComment = {
        ...data,
        user: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
      };

      setComments([...comments, transformedComment]);
      setNewComment('');
      onCommentAdded(postId);
      toast.success('Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-center">Comments</DialogTitle>
        </DialogHeader>

        {/* Comments List */}
        <ScrollArea className="flex-1 px-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground text-sm">No comments yet</p>
              <p className="text-muted-foreground text-xs mt-1">Be the first to comment!</p>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={comment.user?.producer_logo_url} />
                    <AvatarFallback className="text-xs">
                      {comment.user?.producer_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="font-semibold text-sm">{comment.user?.producer_name || 'Anonymous'}</p>
                      {comment.user?.verification_status === 'verified' && (
                        <img 
                          src={verifiedBadge} 
                          alt="Verified" 
                          className="w-4 h-4"
                        />
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed break-words">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Comment Input */}
        <div className="p-4">
          {currentUser ? (
            <form onSubmit={handleSubmitComment} className="flex gap-2">
              <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                <AvatarImage src={currentUser.producer_logo_url} />
                <AvatarFallback className="text-xs">
                  {currentUser.producer_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1"
                  disabled={submitting}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newComment.trim() || submitting}
                  className="px-3"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              Sign in to add a comment
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}