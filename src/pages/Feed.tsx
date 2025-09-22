import { FeedContainer } from '@/components/feed/FeedContainer';
import { MetaTags } from '@/components/MetaTags';

export default function Feed() {
  return (
    <div className="min-h-screen bg-background">
      <MetaTags
        title="Feed - BeatPackz"
        description="Discover the latest beats and music from top producers in our TikTok-style feed"
        url={`${window.location.origin}/feed`}
      />
      
      <div className="w-full h-screen">
        <FeedContainer />
      </div>
    </div>
  );
}