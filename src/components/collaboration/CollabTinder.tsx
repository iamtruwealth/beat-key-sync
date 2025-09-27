import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassMorphismSection } from '@/components/futuristic/GlassMorphismSection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Heart, X, Music, Clock, MessageSquare, Star, Zap, Shuffle } from 'lucide-react';
interface ProducerProfile {
  id: string;
  producer_name: string;
  producer_logo_url?: string;
  genres: string[];
  bio?: string;
  verification_status: string;
  followers_count: number;
  total_beats?: number;
  avg_bpm?: number;
  featured_beat?: {
    title: string;
    genre: string;
    bpm: number;
    file_url: string;
  };
}
export const CollabTinder: React.FC = () => {
  const [currentProfile, setCurrentProfile] = useState<ProducerProfile | null>(null);
  const [profiles, setProfiles] = useState<ProducerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [matches, setMatches] = useState<ProducerProfile[]>([]);
  const [showMatches, setShowMatches] = useState(false);
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadProducerProfiles();
  }, []);
  const loadProducerProfiles = async () => {
    try {
      const {
        data: user
      } = await supabase.auth.getUser();
      if (!user.user) return;

      // Get profiles of producers with public profiles enabled
      const {
        data: profilesData,
        error
      } = await supabase.from('profiles').select(`
          id,
          producer_name,
          producer_logo_url,
          genres,
          bio,
          verification_status,
          followers_count,
          public_profile_enabled
        `).eq('public_profile_enabled', true).eq('role', 'producer').neq('id', user.user.id).not('producer_name', 'is', null).limit(20);
      if (error) throw error;

      // Add some mock data for demo
      const enrichedProfiles = (profilesData || []).map(profile => ({
        ...profile,
        total_beats: Math.floor(Math.random() * 50) + 5,
        avg_bpm: Math.floor(Math.random() * 60) + 100,
        featured_beat: {
          title: `Beat ${Math.floor(Math.random() * 100)}`,
          genre: profile.genres?.[0] || 'Hip-Hop',
          bpm: Math.floor(Math.random() * 60) + 100,
          file_url: ''
        }
      }));
      setProfiles(enrichedProfiles);
      if (enrichedProfiles.length > 0) {
        setCurrentProfile(enrichedProfiles[0]);
      }
    } catch (error) {
      console.error('Error loading producer profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load producer profiles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSwipe = (direction: 'left' | 'right') => {
    if (!currentProfile) return;
    setSwipeDirection(direction);
    setTimeout(() => {
      if (direction === 'right') {
        // Add to matches
        setMatches(prev => [...prev, currentProfile]);
        toast({
          title: "It's a Match! 🎵",
          description: `You and ${currentProfile.producer_name} both want to collaborate!`
        });
      }

      // Move to next profile
      const currentIndex = profiles.findIndex(p => p.id === currentProfile.id);
      const nextIndex = currentIndex + 1;
      if (nextIndex < profiles.length) {
        setCurrentProfile(profiles[nextIndex]);
      } else {
        setCurrentProfile(null);
      }
      setSwipeDirection(null);
    }, 300);
  };
  const resetStack = () => {
    loadProducerProfiles();
  };
  if (loading) {
    return <GlassMorphismSection>
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-neon-magenta border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading producer profiles...</p>
        </div>
      </GlassMorphismSection>;
  }
  return <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-neon-magenta to-electric-blue bg-clip-text text-transparent mb-2">Producers To Collab With </h2>
        <p className="text-muted-foreground">Swipe right to collaborate, left to skip</p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <Button variant="outline" onClick={() => setShowMatches(!showMatches)} className="border-neon-magenta/30 hover:bg-neon-magenta/20">
            <Heart className="w-4 h-4 mr-2" />
            Matches ({matches.length})
          </Button>
          <Button variant="outline" onClick={resetStack} className="border-electric-blue/30 hover:bg-electric-blue/20">
            <Shuffle className="w-4 h-4 mr-2" />
            New Stack
          </Button>
        </div>
      </div>

      {showMatches ? <GlassMorphismSection variant="gradient">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-neon-magenta">Your Matches</h3>
            {matches.length === 0 ? <div className="text-center py-8">
                <Heart className="w-16 h-16 text-neon-magenta mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No matches yet. Keep swiping!</p>
              </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {matches.map(match => <Card key={match.id} className="glass-morphism border-neon-magenta/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-magenta/20 to-electric-blue/20 flex items-center justify-center">
                          <span className="text-lg font-bold text-neon-magenta">
                            {match.producer_name[0]}
                          </span>
                        </div>
                        <div>
                          <CardTitle className="text-neon-magenta">{match.producer_name}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {match.followers_count} followers
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button size="sm" className="w-full bg-neon-magenta/10 hover:bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/30">
                        <MessageSquare className="w-3 h-3 mr-2" />
                        Start Chat
                      </Button>
                    </CardContent>
                  </Card>)}
              </div>}
          </div>
        </GlassMorphismSection> : <div className="flex justify-center">
          <div className="relative w-full max-w-md">
            {currentProfile ? <Card className={`glass-morphism border-border/50 transition-all duration-300 transform ${swipeDirection === 'left' ? '-translate-x-full rotate-12 opacity-0' : swipeDirection === 'right' ? 'translate-x-full -rotate-12 opacity-0' : 'translate-x-0 rotate-0 opacity-100'}`}>
                <CardHeader className="text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neon-magenta/20 to-electric-blue/20 mx-auto mb-4 flex items-center justify-center">
                    <span className="text-3xl font-bold text-neon-magenta">
                      {currentProfile.producer_name[0]}
                    </span>
                  </div>
                  <CardTitle className="text-2xl text-neon-magenta">
                    {currentProfile.producer_name}
                  </CardTitle>
                  <div className="flex items-center justify-center gap-2">
                    {currentProfile.verification_status === 'verified' && <Badge className="bg-neon-cyan/20 text-neon-cyan">
                        <Star className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>}
                    <Badge variant="outline">
                      {currentProfile.followers_count} followers
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {currentProfile.bio && <p className="text-sm text-center text-muted-foreground">
                      {currentProfile.bio}
                    </p>}
                  
                  {/* Genres */}
                  {currentProfile.genres && currentProfile.genres.length > 0 && <div className="text-center">
                      <p className="text-sm font-medium mb-2">Genres</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {currentProfile.genres.slice(0, 4).map(genre => <Badge key={genre} variant="outline" className="text-xs">
                            {genre}
                          </Badge>)}
                      </div>
                    </div>}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 rounded-lg bg-background/20">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Music className="w-4 h-4 text-neon-magenta" />
                      </div>
                      <p className="text-sm font-medium">{currentProfile.total_beats}</p>
                      <p className="text-xs text-muted-foreground">Beats</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background/20">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock className="w-4 h-4 text-electric-blue" />
                      </div>
                      <p className="text-sm font-medium">{currentProfile.avg_bpm}</p>
                      <p className="text-xs text-muted-foreground">Avg BPM</p>
                    </div>
                  </div>

                  {/* Featured Beat */}
                  {currentProfile.featured_beat && <div className="p-3 rounded-lg bg-background/20 text-center">
                      <p className="text-sm font-medium mb-1">Featured Beat</p>
                      <p className="text-sm text-neon-magenta">{currentProfile.featured_beat.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {currentProfile.featured_beat.genre} • {currentProfile.featured_beat.bpm} BPM
                      </p>
                    </div>}

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6">
                    <Button onClick={() => handleSwipe('left')} size="lg" className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30">
                      <X className="w-6 h-6" />
                    </Button>
                    <Button onClick={() => handleSwipe('right')} size="lg" className="flex-1 bg-neon-magenta/10 hover:bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/30">
                      <Heart className="w-6 h-6" />
                    </Button>
                  </div>
                </CardContent>
              </Card> : <GlassMorphismSection>
                <div className="text-center py-12">
                  <Shuffle className="w-16 h-16 text-neon-magenta mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold text-neon-magenta mb-2">No More Profiles</h3>
                  <p className="text-muted-foreground mb-4">
                    You've seen all available producers. Check back later for new profiles!
                  </p>
                  <Button onClick={resetStack} className="bg-gradient-to-r from-neon-magenta to-electric-blue">
                    <Shuffle className="w-4 h-4 mr-2" />
                    Load New Profiles
                  </Button>
                </div>
              </GlassMorphismSection>}
          </div>
        </div>}
    </div>;
};