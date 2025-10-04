import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EPKModuleList } from "@/components/epk/EPKModuleList";
import { FanSubscriptionManager } from "@/components/epk/FanSubscriptionManager";
import SubscriptionAnalytics from "@/components/epk/SubscriptionAnalytics";
import { ExclusiveContentManager } from "@/components/epk/ExclusiveContentManager";
import { WelcomeMessageManager } from "@/components/epk/WelcomeMessageManager";
import { EPKSettings } from "@/components/epk/EPKSettings";
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
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";

export default function ArtistDashboard() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [pendingPaperwork, setPendingPaperwork] = useState<any[]>([]);
  const [activeProjects, setActiveProjects] = useState<any[]>([]);
  const [epkSlug, setEpkSlug] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [epkProfile, setEpkProfile] = useState<any>(null);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [revenueData, setRevenueData] = useState({
    monthlyRevenue: 0,
    lifetimeRevenue: 0,
    availableBalance: 0,
    recentPayments: [] as any[]
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load EPK profile
    const { data: epkData } = await supabase
      .from('artist_epk_profiles')
      .select('*')
      .eq('artist_id', user.id)
      .single();
    
    if (epkData) {
      setEpkProfile(epkData);
      setEpkSlug(epkData.slug);
      setIsPublished(epkData.is_published || false);
    }

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

    // Load pending paperwork
    const { data: paperworkData } = await supabase
      .from('split_sheets')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
    
    setPendingPaperwork(paperworkData || []);

    // Load active projects
    const { data: projectsData } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(6);
    
    setActiveProjects(projectsData || []);

    // Load subscriber count
    const { count: subCount } = await supabase
      .from('fan_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', user.id)
      .eq('status', 'active');
    
    setSubscriberCount(subCount || 0);

    // Load revenue data
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get monthly revenue
    const { data: monthlyPayments } = await supabase
      .from('fan_subscription_payments')
      .select('artist_earnings_cents')
      .eq('artist_id', user.id)
      .gte('payment_date', firstDayOfMonth.toISOString());

    const monthlyRev = monthlyPayments?.reduce((sum, p) => sum + (p.artist_earnings_cents || 0), 0) || 0;

    // Get lifetime revenue
    const { data: allPayments } = await supabase
      .from('fan_subscription_payments')
      .select('artist_earnings_cents')
      .eq('artist_id', user.id);

    const lifetimeRev = allPayments?.reduce((sum, p) => sum + (p.artist_earnings_cents || 0), 0) || 0;

    // Get recent payments
    const { data: recentPays } = await supabase
      .from('fan_subscription_payments')
      .select('*, fan:profiles!fan_subscription_payments_fan_id_fkey(producer_name, first_name, last_name)')
      .eq('artist_id', user.id)
      .order('payment_date', { ascending: false })
      .limit(10);

    setRevenueData({
      monthlyRevenue: monthlyRev,
      lifetimeRevenue: lifetimeRev,
      availableBalance: lifetimeRev, // In real app, subtract paid out amounts
      recentPayments: recentPays || []
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'demo': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'mixing': return <Music className="w-4 h-4 text-blue-500" />;
      case 'mastering': return <BarChart3 className="w-4 h-4 text-purple-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Artist Account</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening with your music.</p>
        </div>
        <Button
          onClick={() => {
            if (isPublished && epkSlug) {
              navigate(`/epk/${epkSlug}`);
            } else {
              navigate('/epk');
            }
          }}
        >
          <Music className="w-4 h-4 mr-2" />
          Go to EPK
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriberCount}</div>
            <p className="text-xs text-muted-foreground">Fan subscribers</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentMessages.length}</div>
            <p className="text-xs text-muted-foreground">New conversations</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Paperwork</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPaperwork.length}</div>
            <p className="text-xs text-muted-foreground">Split sheets to complete</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Earnings Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Revenue & Earnings
          </CardTitle>
          <CardDescription>Track your subscription revenue and manage payouts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Revenue Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground">Monthly Revenue</div>
                <div className="text-2xl font-bold">${(revenueData.monthlyRevenue / 100).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground">Lifetime Earnings</div>
                <div className="text-2xl font-bold">${(revenueData.lifetimeRevenue / 100).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-muted-foreground">Available Balance</div>
                <div className="text-2xl font-bold text-green-600">${(revenueData.availableBalance / 100).toFixed(2)}</div>
                <Button 
                  size="sm" 
                  className="mt-2 w-full"
                  onClick={() => navigate('/producer-dashboard')}
                >
                  Request Payout
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Payments */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Recent Payments</h3>
            <div className="space-y-3">
              {revenueData.recentPayments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No payments received yet</p>
              ) : (
                revenueData.recentPayments.map((payment) => (
                  <div 
                    key={payment.id} 
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {payment.fan?.producer_name || `${payment.fan?.first_name} ${payment.fan?.last_name}` || 'Fan'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        +${(payment.artist_earnings_cents / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Net earnings
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payment Method Info */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Payment Information</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  Payments are processed monthly. Request a payout when your balance reaches $10 or more.
                  Available payout methods: PayPal, Bank Transfer, Stripe, CashApp, Venmo, Zelle.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to help you stay productive</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => navigate('/epk')}
            >
              <DollarSign className="w-6 h-6" />
              Build Artist EPK
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <MessageSquare className="w-6 h-6" />
              Start Conversation
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <FileText className="w-6 h-6" />
              Create Split Sheet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* EPK Management */}
      {epkProfile && (
        <Card>
          <CardHeader>
            <CardTitle>EPK Management</CardTitle>
            <CardDescription>Manage your Electronic Press Kit</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="modules" className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-8">
                <TabsTrigger value="modules">Modules</TabsTrigger>
                <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="content">Exclusive</TabsTrigger>
                <TabsTrigger value="emails">Welcome</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="modules">
                <EPKModuleList epkProfileId={epkProfile.id} />
              </TabsContent>

              <TabsContent value="subscriptions">
                <FanSubscriptionManager />
              </TabsContent>

              <TabsContent value="analytics">
                <SubscriptionAnalytics />
              </TabsContent>

              <TabsContent value="content">
                <ExclusiveContentManager />
              </TabsContent>

              <TabsContent value="emails">
                <WelcomeMessageManager />
              </TabsContent>

              <TabsContent value="settings">
                <EPKSettings epkProfile={epkProfile} onUpdate={(updated) => setEpkProfile(updated)} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}