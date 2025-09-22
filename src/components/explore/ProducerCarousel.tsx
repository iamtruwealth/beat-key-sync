import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { supabase } from '@/integrations/supabase/client';
import verifiedBadge from '@/assets/verified-badge.png';

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

export default function ProducerCarousel() {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopProducers = async () => {
      try {
        // Get producer IDs that have producer names 
        const { data: producerIds, error } = await supabase
          .from('profiles')
          .select('id')
          .not('producer_name', 'is', null)
          .eq('public_profile_enabled', true)
          .eq('role', 'producer')
          .limit(10);

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

    fetchTopProducers();
  }, []);

  if (loading) {
    return (
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">Top Producers</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="w-24 h-24 bg-muted rounded-full mx-auto mb-2" />
                <div className="h-4 bg-muted rounded mx-auto w-16" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold">Top Producers</h2>
          <Link to="/producers">
            <Button variant="outline">View All</Button>
          </Link>
        </div>

        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {producers.slice(0, 7).map((producer) => (
              <CarouselItem key={producer.id} className="pl-2 md:pl-4 basis-1/2 md:basis-1/4 lg:basis-1/7">
                <Link to={`/producer/${producer.id}`} className="block group">
                  <div className="relative">
                    {/* Golden Vinyl Disk with Producer Photo */}
                    <div className="w-24 h-24 mx-auto mb-3 relative">
                      {/* Golden vinyl background */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 shadow-lg">
                        {/* Vinyl texture lines */}
                        <div className="absolute inset-2 rounded-full border border-yellow-600/30"></div>
                        <div className="absolute inset-4 rounded-full border border-yellow-600/20"></div>
                        {/* Producer photo in center */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full overflow-hidden border-2 border-yellow-600/50">
                          {producer.producer_logo_url ? (
                            <img 
                              src={producer.producer_logo_url} 
                              alt={producer.producer_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                              <div className="text-lg font-bold text-muted-foreground">
                                {producer.producer_name?.charAt(0) || 'P'}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Center hole */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-yellow-800/80" />
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors flex items-center justify-center gap-1">
                        {producer.producer_name || 'Unknown Producer'}
                        {producer.verification_status === 'verified' && (
                          <img 
                            src={verifiedBadge} 
                            alt="Verified" 
                            className="w-3 h-3"
                          />
                        )}
                      </h3>
                      {producer.genres && producer.genres.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {producer.genres.slice(0, 2).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </section>
  );
}