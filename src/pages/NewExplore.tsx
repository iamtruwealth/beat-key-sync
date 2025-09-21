import StickyHeader from '@/components/layout/StickyHeader';
import ProducerCarousel from '@/components/explore/ProducerCarousel';
import BeatPackCarousel from '@/components/explore/BeatPackCarousel';
import TopBeatsList from '@/components/explore/TopBeatsList';
import { MetaTags } from '@/components/MetaTags';

export default function NewExplore() {
  return (
    <div className="min-h-screen bg-background">
      <MetaTags 
        title="Explore Beats | BeatPackz - Discover Top Producers & Beat Packs"
        description="Discover the hottest beats, top producers, and trending beat packs. Stream, download, and purchase high-quality beats from talented producers worldwide."
        image="/assets/beat-packz-social-image.png"
      />
      
      <StickyHeader />
      
      <main>
        <ProducerCarousel />
        <BeatPackCarousel />
        <TopBeatsList limit={50} />
      </main>
    </div>
  );
}