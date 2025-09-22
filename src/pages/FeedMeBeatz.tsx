import { FeedContainer } from '@/components/feed/FeedContainer';
import { MetaTags } from '@/components/MetaTags';

export default function FeedMeBeatz() {
  return (
    <div className="min-h-screen bg-background">
      <MetaTags
        title="Feed Me Beatz - BeatPackz"
        description="Discover the latest beats and music from all producers on BeatPackz. Your ultimate feed for fresh beats!"
        url={`${window.location.origin}/feed-me-beatz`}
      />
      
      <div className="w-full h-screen">
        <FeedContainer showUploadButton={true} />
      </div>
    </div>
  );
}