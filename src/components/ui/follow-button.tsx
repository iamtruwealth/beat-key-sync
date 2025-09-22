import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FollowButtonProps {
  targetUserId: string;
  currentUserId?: string;
  targetUserName: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export function FollowButton({
  targetUserId,
  currentUserId,
  targetUserName,
  variant = 'default',
  size = 'default'
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check if already following
  useEffect(() => {
    // Don't run effect if conditions aren't met
    if (!currentUserId || currentUserId === targetUserId) {
      return;
    }

    const checkFollowStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('followed_id', targetUserId)
          .maybeSingle();

        if (error) throw error;
        setIsFollowing(!!data);
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };

    checkFollowStatus();
  }, [currentUserId, targetUserId]);

  // Don't show follow button for own profile - AFTER hooks are called
  if (!currentUserId || currentUserId === targetUserId) {
    return null;
  }

  const handleFollow = async () => {
    if (!currentUserId) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to follow users",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('followed_id', targetUserId);

        if (error) throw error;
        
        setIsFollowing(false);
        toast({
          title: "Unfollowed",
          description: `You unfollowed ${targetUserName}`
        });
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            followed_id: targetUserId
          });

        if (error) throw error;

        // Create notification for the followed user
        await supabase.rpc('create_notification', {
          target_user_id: targetUserId,
          notification_type: 'follow',
          notification_message: `${targetUserName} started following you`,
          notification_actor_id: currentUserId
        });

        setIsFollowing(true);
        toast({
          title: "Following!",
          description: `You are now following ${targetUserName}`
        });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleFollow}
      disabled={isLoading}
      variant={variant}
      size={size}
      className="gap-2"
    >
      {isFollowing ? (
        <>
          <UserCheck className="w-4 h-4" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" />
          Follow
        </>
      )}
    </Button>
  );
}