import StickyHeader from '@/components/layout/StickyHeader';
import ProducerCarousel from '@/components/explore/ProducerCarousel';
import BeatPackCarousel from '@/components/explore/BeatPackCarousel';
import TopBeatsList from '@/components/explore/TopBeatsList';
import { MetaTags } from '@/components/MetaTags';
import { FuturisticNavigation } from '@/components/futuristic/FuturisticNavigation';
import { ScrollAnimationWrapper } from '@/components/futuristic/ScrollAnimationWrapper';
import { GlassMorphismSection } from '@/components/futuristic/GlassMorphismSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, Music, Users, Zap } from 'lucide-react';
import { useState } from 'react';

export default function NewExplore() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <MetaTags 
        title="Explore Beats | BeatPackz - Discover Top Producers & Beat Packs"
        description="Discover the hottest beats, top producers, and trending beat packs. Stream, download, and purchase high-quality beats from talented producers worldwide."
        image="/assets/beat-packz-social-image.png"
      />
      
      <FuturisticNavigation />
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl -top-48 -left-48 animate-float" />
          <div className="absolute w-80 h-80 bg-neon-magenta/10 rounded-full blur-3xl -bottom-40 -right-40 animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute w-64 h-64 bg-electric-blue/10 rounded-full blur-2xl top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-float" style={{ animationDelay: '1s' }} />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <ScrollAnimationWrapper>
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="gradient-text">Explore</span>{" "}
                <span className="text-neon-cyan">the Sound</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                Discover trending beats, connect with top producers, and find your next musical inspiration
              </p>
              
              {/* Search Bar */}
              <GlassMorphismSection className="max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-4 h-5 w-5 text-neon-cyan" />
                  <Input
                    placeholder="Search beats, producers, or genres..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 text-lg glass-morphism border-neon-cyan/30 focus:border-neon-cyan bg-background/50"
                  />
                  <Button 
                    className="absolute right-2 top-2 bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue-glow neon-glow-hover"
                    size="sm"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </GlassMorphismSection>

              {/* Stats */}
              <div className="flex justify-center space-x-8 mt-8">
                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-neon-cyan/20 rounded-full mx-auto mb-2">
                    <TrendingUp className="w-6 h-6 text-neon-cyan" />
                  </div>
                  <div className="text-lg font-bold text-neon-cyan">Hot</div>
                  <div className="text-sm text-muted-foreground">Trending</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-neon-magenta/20 rounded-full mx-auto mb-2">
                    <Music className="w-6 h-6 text-neon-magenta" />
                  </div>
                  <div className="text-lg font-bold text-neon-magenta">Fresh</div>
                  <div className="text-sm text-muted-foreground">New Drops</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-electric-blue/20 rounded-full mx-auto mb-2">
                    <Users className="w-6 h-6 text-electric-blue" />
                  </div>
                  <div className="text-lg font-bold text-electric-blue">Pro</div>
                  <div className="text-sm text-muted-foreground">Producers</div>
                </div>
              </div>
            </div>
          </ScrollAnimationWrapper>
        </div>
      </section>

      <main className="relative">
        {/* Producers Section */}
        <ScrollAnimationWrapper>
          <section className="py-16 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/5 to-transparent" />
            <div className="container mx-auto px-6 relative z-10">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-5xl font-bold mb-4">
                  <span className="text-electric-blue">Featured</span>{" "}
                  <span className="gradient-text">Producers</span>
                </h2>
                <p className="text-lg text-muted-foreground">Connect with the most talented beatmakers</p>
              </div>
              <div className="glass-morphism rounded-2xl p-6">
                <ProducerCarousel />
              </div>
            </div>
          </section>
        </ScrollAnimationWrapper>

        {/* Beat Packs Section */}
        <ScrollAnimationWrapper>
          <section className="py-16 relative">
            <div className="container mx-auto px-6 relative z-10">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-5xl font-bold mb-4">
                  <span className="gradient-text">Top</span>{" "}
                  <span className="text-neon-magenta">Beat Packs</span>
                </h2>
                <p className="text-lg text-muted-foreground">Curated collections of premium beats</p>
              </div>
              <div className="glass-morphism rounded-2xl p-6">
                <BeatPackCarousel />
              </div>
            </div>
          </section>
        </ScrollAnimationWrapper>

        <ScrollAnimationWrapper>
          <section className="py-16 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/5 to-transparent" />
            <div className="container mx-auto px-4 relative z-10">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-5xl font-bold mb-4">
                  <span className="text-neon-cyan">Trending</span>{" "}
                  <span className="gradient-text">Beats</span>
                </h2>
                <p className="text-lg text-muted-foreground">The hottest tracks right now</p>
              </div>
              <TopBeatsList limit={50} />
            </div>
          </section>
        </ScrollAnimationWrapper>
      </main>
    </div>
  );
}