import { FeedContainer } from '@/components/feed/FeedContainer';
import { MetaTags } from '@/components/MetaTags';
import { FeedFilter } from '@/components/feed/FeedFilter';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function FeedMeBeatz() {
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
        title="Feed Me Beatz - BeatPackz"
        description="Discover the latest beats and music from all producers on BeatPackz. Your ultimate feed for fresh beats!"
        url={`${window.location.origin}/feed-me-beatz`}
      />
      
      <div className="w-full h-screen flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-sm border-b">
          <FeedFilter 
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            followingCount={followingCount}
          />
        </div>
        
        <div className="w-full h-screen pt-16">
          <FeedContainer 
            feedType={activeFilter} 
            currentUser={currentUser} 
            showUploadButton={true}
            useFeedMeBeatzPost={true}
            fullScreen={true}
          />
        </div>
      </div>
    </div>
  );
}