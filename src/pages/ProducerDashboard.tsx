import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { StatsCard } from "@/components/dashboard/StatsCard";
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
  Clock
} from "lucide-react";

// Dashboard stats for project management
const dashboardStats = [
  {
    title: "Total Projects",
    value: 24,
    description: "Active projects",
    icon: FolderOpen,
    trend: { value: 12, isPositive: true },
  },
  {
    title: "Audio Files",
    value: 156,
    description: "Stems uploaded",
    icon: Music,
    trend: { value: 8, isPositive: true },
  },
  {
    title: "Collaborators",
    value: 8,
    description: "Active this month",
    icon: Users,
    trend: { value: 2, isPositive: true },
  },
  {
    title: "Studio Time",
    value: "47h",
    description: "This week",
    icon: Clock,
    trend: { value: 15, isPositive: true },
  },
];

export default function ProducerDashboard() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [beatPacks, setBeatPacks] = useState<any[]>([]);
  const [beats, setBeats] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [isMasterAccount, setIsMasterAccount] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user is master account
    setIsMasterAccount(user.email === 'iamtruwealth@gmail.com');

    // Load notifications
    const { data: notificationsData } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
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
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(5);
    
    setRecentMessages(messagesData || []);

    // Load beat packs
    const { data: beatPacksData } = await supabase
      .from('beat_packs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6);
    
    setBeatPacks(beatPacksData || []);

    // Load beats
    const { data: beatsData } = await supabase
      .from('beats')
      .select('*')
      .eq('producer_id', user.id)
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
      .eq('producer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    setRecentSales(salesData || []);

    // Load earnings
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_earnings_cents')
      .eq('id', user.id)
      .single();
    
    setTotalEarnings(profile?.total_earnings_cents || 0);
  };

  const totalSales = recentSales.reduce((sum, sale) => sum + (sale.amount_received || 0), 0);
  const formatCurrency = (cents: number) => (cents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Producer Marketplace</h1>
          <p className="text-muted-foreground">Upload beats, track sales, and manage your music business.</p>
        </div>
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
            <CardTitle className="text-sm font-medium">Recent Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentSales.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
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
        {dashboardStats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
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
        
        <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-2">Collaborate</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Share your projects with other producers and get feedback.
          </p>
          <Button variant="studio" size="sm">
            Invite Producer
          </Button>
        </div>
        
        <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-border/20 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-2">Explore Library</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Browse your complete library of stems and projects.
          </p>
          <Button variant="waveform" size="sm">
            Browse Library
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className={`grid w-full ${isMasterAccount ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Beats
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
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin
            </TabsTrigger>
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
          <TabsContent value="admin">
            <UserVerificationManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}