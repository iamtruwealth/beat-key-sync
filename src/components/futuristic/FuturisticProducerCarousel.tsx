import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { supabase } from '@/integrations/supabase/client';
import { ScrollAnimationWrapper } from './ScrollAnimationWrapper';
import { Users, Star, Music, MapPin } from 'lucide-react';

interface Producer {
  id: string;
  producer_name: string;
  producer_logo_url: string;
  genres: string[];
  bio: string;
  verification_status: string;
  banner_url: string;
  social_links: any;
}

export function FuturisticProducerCarousel() {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedProducers = async () => {
      try {
        // Get producer IDs that have producer names 
        const { data: producerIds, error } = await supabase
          .from('profiles')
          .select('id')
          .not('producer_name', 'is', null)
          .eq('public_profile_enabled', true)
          .eq('role', 'producer')
          .order('track_upload_count', { ascending: false })
          .limit(8);

        if (error) throw error;

        if (producerIds) {
          // Use the secure function to get public profile data
          const producerData = await Promise.all(
            producerIds.map(async ({ id }) => {
              const { data } = await supabase.rpc('get_public_profile_info', { profile_id: id });
              return data?.[0];
            })
          );
          setProducers(producerData.filter(Boolean) || []);
        }
      } catch (error) {
        console.error('Error fetching producers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProducers();
  }, []);

  if (loading) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="gradient-text">Featured</span>{" "}
              <span className="text-electric-blue">Producers</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse text-center">
                <div className="w-24 h-24 bg-muted rounded-full mx-auto mb-3 glass-morphism" />
                <div className="h-4 bg-muted rounded mx-auto w-16" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/5 to-transparent" />
      
      <div className="container mx-auto px-6 relative z-10">
        <ScrollAnimationWrapper>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="gradient-text">Featured</span>{" "}
              <span className="text-electric-blue">Producers</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Connect with the most talented beatmakers in the industry
            </p>
          </div>
        </ScrollAnimationWrapper>

        <Carousel
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {producers.map((producer, index) => (
              <CarouselItem key={producer.id} className="pl-2 md:pl-4 basis-1/2 md:basis-1/4 lg:basis-1/6">
                <ScrollAnimationWrapper animation="scale-in" delay={index * 100}>
                  <Link to={`/producer/${producer.id}`} className="block group">
                    <div className="relative text-center">
                      {/* Futuristic Vinyl Disk with Producer Photo */}
                      <div className="w-24 h-24 mx-auto mb-4 relative group-hover:scale-110 transition-transform duration-300">
                        {/* Glowing vinyl background */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-neon-cyan via-electric-blue to-neon-magenta shadow-lg group-hover:shadow-xl group-hover:shadow-neon-cyan/30 transition-all duration-300">
                          {/* Animated rings */}
                          <div className="absolute inset-2 rounded-full border border-neon-cyan/40 animate-spin" style={{ animationDuration: '8s' }}></div>
                          <div className="absolute inset-3 rounded-full border border-electric-blue/30 animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }}></div>
                          
                          {/* Producer photo in center */}
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full overflow-hidden border-2 border-neon-cyan/70 group-hover:border-neon-cyan transition-colors">
                            {producer.producer_logo_url ? (
                              <img 
                                src={producer.producer_logo_url} 
                                alt={producer.producer_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                                <div className="text-lg font-bold text-neon-cyan">
                                  {producer.producer_name?.charAt(0) || 'P'}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Center hole with glow */}
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-background border border-electric-blue group-hover:shadow-lg group-hover:shadow-electric-blue/50 transition-all" />
                          
                          {/* Verification badge */}
                          {producer.verification_status === 'verified' && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-neon-green rounded-full flex items-center justify-center border-2 border-background">
                              <Star className="w-3 h-3 text-background fill-current" />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm truncate group-hover:text-neon-cyan transition-colors flex items-center justify-center gap-1">
                          {producer.producer_name || 'Unknown Producer'}
                          {producer.verification_status === 'verified' && (
                            <img 
                              src="/src/assets/verified-badge.png"
                              alt="Verified" 
                              className="w-3 h-3"
                            />
                          )}
                        </h3>
                        
                        {producer.genres && producer.genres.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-1">
                            {producer.genres.slice(0, 2).map((genre, idx) => (
                              <span 
                                key={idx}
                                className="text-xs px-2 py-1 rounded-full bg-electric-blue/20 text-electric-blue border border-electric-blue/30"
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Floating action buttons on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex justify-center space-x-2 mt-3">
                          <div className="w-8 h-8 bg-neon-cyan/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-neon-cyan/30 hover:bg-neon-cyan hover:text-background transition-colors">
                            <Music className="w-4 h-4" />
                          </div>
                          <div className="w-8 h-8 bg-neon-magenta/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-neon-magenta/30 hover:bg-neon-magenta hover:text-background transition-colors">
                            <Users className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </ScrollAnimationWrapper>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="glass-morphism border-electric-blue text-electric-blue hover:bg-electric-blue hover:text-background" />
          <CarouselNext className="glass-morphism border-electric-blue text-electric-blue hover:bg-electric-blue hover:text-background" />
        </Carousel>

        <ScrollAnimationWrapper className="text-center mt-12">
          <Link to="/browse-producers">
            <Button 
              size="lg"
              variant="outline"
              className="border-2 border-electric-blue text-electric-blue hover:bg-electric-blue hover:text-background hover:shadow-lg hover:shadow-electric-blue/30 transition-all duration-300 px-8 py-4 text-lg"
            >
              <Users className="w-5 h-5 mr-2" />
              View All Producers
            </Button>
          </Link>
        </ScrollAnimationWrapper>
      </div>
    </section>
  );
}