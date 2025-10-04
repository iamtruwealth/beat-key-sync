import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BeatUploadForm } from "@/components/beats/BeatUploadForm";
import { RevenueTracker } from "@/components/beats/RevenueTracker";
import { PayoutRequestForm } from "@/components/beats/PayoutRequestForm";
import { BeatSalesTracker } from "@/components/beats/BeatSalesTracker";
import { UserVerificationManager } from "@/components/admin/UserVerificationManager";
import { OnboardingManager } from "@/components/onboarding/OnboardingManager";
import { ProducerSubscriptionManager } from "@/components/beats/ProducerSubscriptionManager";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { 
  Bell, 
  MessageSquare, 
  FileText, 
  Music, 
  DollarSign, 
  BarChart3, 
  User, 
  Users, 
  Plus,
  Download,
  ShoppingBag,
  TrendingUp,
  Eye,
  Upload,
  CreditCard,
  Shield,
  FolderOpen,
  Clock,
  MapPin,
  Zap,
  Activity
} from "lucide-react";

export default function ProducerDashboard() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [beatPacks, setBeatPacks] = useState<any[]>([]);
  const [beats, setBeats] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isMasterAccount, setIsMasterAccount] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'producer' | 'artist' | null>(null);
  const [productionStats, setProductionStats] = useState({
    totalProjects: 0,
    audioFiles: 0,
    collaborators: 0,
    studioTime: 0
  });
  const navigate = useNavigate();

  // Get user data first
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      setCurrentUser(user);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('ProducerDashboard role fetch error:', profileError.message);
      }

      const role = (profile?.role as 'producer' | 'artist' | null) ?? null;
      setUserRole(role);
    };

    loadUserData();
  }, [navigate]);

  // Check onboarding status
  const { needsOnboarding, loading: onboardingLoading } = useOnboardingStatus(currentUser?.id, userRole);

  useEffect(() => {
    const run = async () => {
      if (currentUser && userRole && !onboardingLoading) {
        if (needsOnboarding && userRole === 'producer') {
          // Re-validate from DB to avoid false positives
          const { data: guide } = await supabase
            .from('onboarding_guides')
            .select('id')
            .eq('role', 'producer')
            .eq('is_active', true)
            .maybeSingle();

          if (guide) {
            const { data: progress } = await supabase
              .from('user_onboarding_progress')
              .select('is_completed, is_skipped')
              .eq('user_id', currentUser.id)
              .eq('guide_id', guide.id)
              .maybeSingle();

            if (progress?.is_completed || progress?.is_skipped) {
              loadDashboardData();
              return;
            }
          }

          navigate('/onboarding');
          return;
        }
        loadDashboardData();
      }
    };
    run();
  }, [currentUser, userRole, needsOnboarding, onboardingLoading]);

  const loadDashboardData = async () => {
    if (!currentUser) return;

    // Check if user is master account
    setIsMasterAccount(currentUser.email === 'iamtruwealth@gmail.com');

    // Load notifications
    const { data: notificationsData } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(5);
    
    setNotifications(notificationsData || []);

    // Load recent messages
    const { data: messagesData } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(first_name, last_name, producer_name)
      `)
      .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false })
      .limit(5);
    
    setRecentMessages(messagesData || []);

    // Load beat packs
    const { data: beatPacksData } = await supabase
      .from('beat_packs')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(6);
    
    setBeatPacks(beatPacksData || []);

    // Load beats
    const { data: beatsData } = await supabase
      .from('beats')
      .select('*')
      .eq('producer_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    setBeats(beatsData || []);

    // Load recent sales
    const { data: salesData } = await supabase
      .from('beat_sales')
      .select(`
        *,
        beats(title)
      `)
      .eq('producer_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    setRecentSales(salesData || []);

    // Load earnings
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_earnings_cents')
      .eq('id', currentUser.id)
      .single();
    
    setTotalEarnings(profile?.total_earnings_cents || 0);

    // Load fan subscriptions count
    const { count: subscribersCount } = await supabase
      .from('fan_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', currentUser.id)
      .eq('status', 'active');
    
    setSubscriberCount(subscribersCount || 0);

    // Load production stats
    // Total projects (created or member of)
    const { data: createdProjects } = await supabase
      .from('collaboration_projects')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', currentUser.id);
    
    const { data: memberProjects } = await supabase
      .from('collaboration_members')
      .select('collaboration_id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('status', 'accepted');

    const totalProjects = (createdProjects?.length || 0) + (memberProjects?.length || 0);

    // Audio files uploaded
    const { count: audioFilesCount } = await supabase
      .from('session_audio_recordings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);

    // Collaborators (distinct users from projects)
    const { data: projectIds } = await supabase
      .from('collaboration_projects')
      .select('id')
      .eq('created_by', currentUser.id);

    const { data: memberProjectIds } = await supabase
      .from('collaboration_members')
      .select('collaboration_id')
      .eq('user_id', currentUser.id)
      .eq('status', 'accepted');

    const allProjectIds = [
      ...(projectIds?.map(p => p.id) || []),
      ...(memberProjectIds?.map(m => m.collaboration_id) || [])
    ];

    let collaboratorsCount = 0;
    if (allProjectIds.length > 0) {
      const { data: collaborators } = await supabase
        .from('collaboration_members')
        .select('user_id')
        .in('collaboration_id', allProjectIds)
        .neq('user_id', currentUser.id)
        .eq('status', 'accepted');
      
      const uniqueCollaborators = new Set(collaborators?.map(c => c.user_id) || []);
      collaboratorsCount = uniqueCollaborators.size;
    }

    // Studio time (sum of all Cook Mode session durations - completed and ongoing)
    const { data: sessions } = await supabase
      .from('collaboration_sessions')
      .select('started_at, ended_at')
      .contains('participants', [currentUser.id]);

    let totalMinutes = 0;
    const now = Date.now();
    
    sessions?.forEach(session => {
      if (session.started_at) {
        const start = new Date(session.started_at).getTime();
        // If session is ongoing (no ended_at), calculate up to now
        const end = session.ended_at ? new Date(session.ended_at).getTime() : now;
        totalMinutes += (end - start) / (1000 * 60);
      }
    });

    setProductionStats({
      totalProjects,
      audioFiles: audioFilesCount || 0,
      collaborators: collaboratorsCount,
      studioTime: Math.round(totalMinutes / 60) // Convert to hours
    });
  };

  // Show loading while checking onboarding status
  if (onboardingLoading || !currentUser || !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const totalSales = recentSales.reduce((sum, sale) => sum + (sale.amount_received || 0), 0);
  const formatCurrency = (cents: number) => (cents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Producer Marketplace</h1>
        <p className="text-muted-foreground">Upload beats, track sales, and manage your music business.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Beats</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{beats.length}</div>
            <p className="text-xs text-muted-foreground">Uploaded beats</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatCurrency(totalEarnings)}</div>
            <p className="text-xs text-muted-foreground">All time revenue</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fans</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriberCount}</div>
            <p className="text-xs text-muted-foreground">Active subscribers</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Beat Packs</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{beatPacks.length}</div>
            <p className="text-xs text-muted-foreground">Collections</p>
          </CardContent>
        </Card>
      </div>

      {/* Production Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Projects"
          value={productionStats.totalProjects}
          description="Active collaborations"
          icon={FolderOpen}
        />
        <StatsCard
          title="Audio Files"
          value={productionStats.audioFiles}
          description="Recordings uploaded"
          icon={Music}
        />
        <StatsCard
          title="Collaborators"
          value={productionStats.collaborators}
          description="Unique producers"
          icon={Users}
        />
        <StatsCard
          title="Studio Time"
          value={`${productionStats.studioTime}h`}
          description="Total session time"
          icon={Clock}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-2">Upload Stems</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload individual stems and associate them with your beats.
          </p>
          <Button 
            variant="producer" 
            size="sm"
            onClick={() => navigate('/upload-stems')}
          >
            Upload Files
          </Button>
        </div>
        
        <Link 
          to="/cook-mode" 
          className="block bg-gradient-to-br from-neon-cyan/20 to-electric-blue/20 border border-neon-cyan/30 rounded-lg p-6 hover:from-neon-cyan/30 hover:to-electric-blue/30 hover:border-neon-cyan/50 transition-all duration-300 group cursor-pointer transform hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]"
        >
          <h3 className="font-semibold text-neon-cyan mb-2 flex items-center gap-2 group-hover:text-white transition-colors">
            <Zap className="w-5 h-5 animate-pulse" />
            Cook Mode - Live Collaboration
          </h3>
          <p className="text-sm text-muted-foreground mb-4 group-hover:text-white/80 transition-colors">
            Enter the future of music creation. Real-time collaborative beat making with MIDI recording and live sync.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-neon-cyan to-electric-blue text-black font-semibold rounded-lg hover:opacity-90 transition-opacity">
            <Activity className="w-4 h-4" />
            Enter Cook Mode
          </div>
        </Link>
        
        <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-border/20 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-2">Explore Artists</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Browse artists to send beats to and collaborate with.
          </p>
          <Button variant="waveform" size="sm">
            Browse Library
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className={`grid w-full ${isMasterAccount ? 'grid-cols-6' : 'grid-cols-5'}`}>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Beats
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payouts
          </TabsTrigger>
          {isMasterAccount && (
            <>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Admin
              </TabsTrigger>
              <TabsTrigger value="onboarding" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Onboarding
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Recent Sales */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Recent Sales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentSales.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent sales</p>
                ) : (
                  recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <ShoppingBag className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{sale.beats?.title || 'Unknown Beat'}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(sale.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">${formatCurrency(sale.amount_received - sale.platform_fee)}</p>
                        <p className="text-xs text-muted-foreground">${formatCurrency(sale.amount_received)} total</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent Beats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Recent Beats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {beats.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No beats uploaded yet</p>
                ) : (
                  beats.slice(0, 5).map((beat) => (
                    <div key={beat.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Music className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{beat.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(beat.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {beat.is_free ? (
                          <Badge className="bg-green-100 text-green-800">FREE</Badge>
                        ) : (
                          <p className="font-medium">${formatCurrency(beat.price_cents)}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="upload">
          <BeatUploadForm onSuccess={loadDashboardData} />
        </TabsContent>

        <TabsContent value="subscriptions">
          <ProducerSubscriptionManager />
        </TabsContent>

        <TabsContent value="revenue">
          <div className="space-y-6">
            <BeatSalesTracker />
            <RevenueTracker />
          </div>
        </TabsContent>

        <TabsContent value="payouts">
          <PayoutRequestForm />
        </TabsContent>

        {isMasterAccount && (
          <>
            <TabsContent value="admin">
              <UserVerificationManager />
            </TabsContent>
            <TabsContent value="onboarding">
              <OnboardingManager />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}