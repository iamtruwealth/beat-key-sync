import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MetaTags } from '@/components/MetaTags';
import { GlassMorphismSection } from '@/components/futuristic/GlassMorphismSection';
import { Users, Zap, Music, TrendingUp, Link2, Shuffle, Crown, Share2 } from 'lucide-react';
import { CollabProjects } from '@/components/collaboration/CollabProjects';
import { CollabMatchmaking } from '@/components/collaboration/CollabMatchmaking';
import { CollabTinder } from '@/components/collaboration/CollabTinder';
import { RoyaltyMarketplace } from '@/components/collaboration/RoyaltyMarketplace';
import { supabase } from '@/integrations/supabase/client';

const Collaborate = () => {
  const [activeTab, setActiveTab] = useState('projects');
  const [stats, setStats] = useState({
    activeCollabs: 0,
    liveSessions: 0,
    sharedEarnings: 0,
    packReleases: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [collabsData, sessionsData, packData] = await Promise.all([
      supabase
        .from('collaboration_members')
        .select('collaboration_id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('status', 'accepted'),
      supabase
        .from('collaboration_sessions')
        .select('id', { count: 'exact' })
        .is('ended_at', null)
        .contains('participants', [user.id]),
      supabase
        .from('collaboration_projects')
        .select('id', { count: 'exact' })
        .or(`created_by.eq.${user.id},id.in.(${await getCollabIds(user.id)})`)
    ]);

    setStats({
      activeCollabs: collabsData.count || 0,
      liveSessions: sessionsData.count || 0,
      sharedEarnings: 0,
      packReleases: packData.count || 0
    });
  };

  const getCollabIds = async (userId: string) => {
    const { data } = await supabase
      .from('collaboration_members')
      .select('collaboration_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');
    return data?.map(m => m.collaboration_id).join(',') || '';
  };

  const collaborationStats = [
    {
      title: "Active Collabs",
      value: stats.activeCollabs.toString(),
      icon: Users,
      change: "Total projects",
      color: "text-neon-cyan"
    },
    {
      title: "Live Sessions",
      value: stats.liveSessions.toString(),
      icon: Zap,
      change: "Cooking now",
      color: "text-electric-blue"
    },
    {
      title: "Shared Earnings",
      value: `$${(stats.sharedEarnings / 100).toFixed(0)}`,
      icon: TrendingUp,
      change: "From collabs",
      color: "text-neon-magenta"
    },
    {
      title: "Pack Releases",
      value: stats.packReleases.toString(),
      icon: Music,
      change: "Collaborative",
      color: "text-neon-cyan"
    }
  ];

  return (
    <div className="min-h-screen bg-background p-6 relative overflow-hidden">
      <MetaTags 
        title="Collaborate - BeatPackz"
        description="Connect with producers, create together, and build the next generation of beats"
      />
      
      {/* Futuristic background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl -top-48 -left-48 animate-float" />
        <div className="absolute w-80 h-80 bg-electric-blue/10 rounded-full blur-3xl top-1/3 -right-40 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute w-64 h-64 bg-neon-magenta/10 rounded-full blur-3xl bottom-0 left-1/3 animate-float" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-electric-blue/20 border border-neon-cyan/30">
              <Users className="w-8 h-8 text-neon-cyan" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-neon-cyan via-electric-blue to-neon-magenta bg-clip-text text-transparent">
                Collaboration Hub
              </h1>
              <p className="text-muted-foreground text-lg">
                Connect • Create • Conquer
              </p>
            </div>
          </div>

          {/* Stats Dashboard */}
          <GlassMorphismSection variant="gradient" className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {collaborationStats.map((stat, index) => (
                <Card key={stat.title} className="bg-card/50 border-border/50 hover:border-neon-cyan/50 transition-all duration-300">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                        <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                        <p className={`text-xs ${stat.color}`}>{stat.change}</p>
                      </div>
                      <div className={`p-2 rounded-lg bg-gradient-to-br from-background/20 to-background/10 ${stat.color}`}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </GlassMorphismSection>
        </div>

        {/* Main Collaboration Interface */}
        <GlassMorphismSection variant="neon">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 bg-background/20 border border-border/50">
              <TabsTrigger 
                value="projects" 
                className="data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Projects</span>
              </TabsTrigger>
              <TabsTrigger 
                value="matchmaking" 
                className="data-[state=active]:bg-electric-blue/20 data-[state=active]:text-electric-blue flex items-center gap-2"
              >
                <Link2 className="w-4 h-4" />
                <span className="hidden sm:inline">Find Collabs</span>
              </TabsTrigger>
              <TabsTrigger 
                value="tinder" 
                className="data-[state=active]:bg-neon-magenta/20 data-[state=active]:text-neon-magenta flex items-center gap-2"
              >
                <Shuffle className="w-4 h-4" />
                <span className="hidden sm:inline">Swipe</span>
              </TabsTrigger>
              <TabsTrigger 
                value="marketplace" 
                className="data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan flex items-center gap-2"
              >
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Royalties</span>
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="data-[state=active]:bg-electric-blue/20 data-[state=active]:text-electric-blue flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger 
                value="sessions" 
                className="data-[state=active]:bg-neon-magenta/20 data-[state=active]:text-neon-magenta flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">Live</span>
              </TabsTrigger>
              <TabsTrigger 
                value="contests" 
                className="data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan flex items-center gap-2"
              >
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Contests</span>
              </TabsTrigger>
              <TabsTrigger 
                value="invites" 
                className="data-[state=active]:bg-electric-blue/20 data-[state=active]:text-electric-blue flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Invites</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="mt-6">
              <CollabProjects />
            </TabsContent>

            <TabsContent value="matchmaking" className="mt-6">
              <CollabMatchmaking />
            </TabsContent>

            <TabsContent value="tinder" className="mt-6">
              <CollabTinder />
            </TabsContent>

            <TabsContent value="marketplace" className="mt-6">
              <RoyaltyMarketplace />
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <GlassMorphismSection>
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 text-neon-cyan mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-neon-cyan mb-2">Analytics Dashboard</h3>
                  <p className="text-muted-foreground">
                    Track your collaboration performance, earnings splits, and audience engagement.
                  </p>
                  <Button className="mt-4" variant="outline">
                    Coming Soon
                  </Button>
                </div>
              </GlassMorphismSection>
            </TabsContent>

            <TabsContent value="sessions" className="mt-6">
              <GlassMorphismSection>
                <div className="text-center py-12">
                  <Zap className="w-16 h-16 text-electric-blue mx-auto mb-4 animate-pulse" />
                  <h3 className="text-2xl font-bold text-electric-blue mb-2">Live Cook Mode</h3>
                  <p className="text-muted-foreground">
                    Real-time collaboration sessions with audio streaming and live editing.
                  </p>
                  <Button 
                    className="mt-4" 
                    variant="outline"
                    onClick={() => navigate('/cook-mode')}
                  >
                    Enter Cook Mode
                  </Button>
                </div>
              </GlassMorphismSection>
            </TabsContent>

            <TabsContent value="contests" className="mt-6">
              <GlassMorphismSection>
                <div className="text-center py-12">
                  <Crown className="w-16 h-16 text-neon-magenta mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-neon-magenta mb-2">Monthly Contests</h3>
                  <p className="text-muted-foreground">
                    Compete in collaboration challenges and win homepage features.
                  </p>
                  <Button className="mt-4" variant="outline">
                    View Contests
                  </Button>
                </div>
              </GlassMorphismSection>
            </TabsContent>

            <TabsContent value="invites" className="mt-6">
              <GlassMorphismSection>
                <div className="text-center py-12">
                  <Share2 className="w-16 h-16 text-neon-cyan mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-neon-cyan mb-2">Invite System</h3>
                  <p className="text-muted-foreground">
                    Send exclusive collaboration invites and manage incoming requests.
                  </p>
                  <Button className="mt-4" variant="outline">
                    Manage Invites
                  </Button>
                </div>
              </GlassMorphismSection>
            </TabsContent>
          </Tabs>
        </GlassMorphismSection>
      </div>
    </div>
  );
};

export default Collaborate;