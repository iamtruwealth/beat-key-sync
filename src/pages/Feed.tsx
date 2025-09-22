import { FeedContainer } from '@/components/feed/FeedContainer';
import { MetaTags } from '@/components/MetaTags';
import { FeedFilter } from '@/components/feed/FeedFilter';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function Feed() {
  const [activeFilter, setActiveFilter] = useState<'for-you' | 'following'>('for-you');
  const [followingCount, setFollowingCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        // Get following count
        const { count } = await supabase
          .from('follows')
          .select('*', { count: 'exact' })
          .eq('follower_id', user.id);
        
        setFollowingCount(count || 0);
      }
    };
    
    getCurrentUser();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <MetaTags
        title="Feed - BeatPackz"
        description="Discover the latest beats and music from top producers in our TikTok-style feed"
        url={`${window.location.origin}/feed`}
      />
      
      <div className="w-full h-screen flex flex-col">
        <div className="p-4 border-b">
          <FeedFilter 
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            followingCount={followingCount}
          />
        </div>
        
        <div className="flex-1">
          <FeedContainer feedType={activeFilter} currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
}