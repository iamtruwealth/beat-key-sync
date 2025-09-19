import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Eye
} from "lucide-react";

export default function ProducerDashboard() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [beatPacks, setBeatPacks] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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

    // Mock recent sales data (would be real in production)
    setRecentSales([
      { id: 1, beatPack: "Fire Trap Beats Vol. 1", amount: 25, date: new Date().toISOString() },
      { id: 2, beatPack: "Chill Lo-Fi Pack", amount: 15, date: new Date(Date.now() - 86400000).toISOString() },
    ]);
  };

  const totalSales = recentSales.reduce((sum, sale) => sum + sale.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Producer Dashboard</h1>
          <p className="text-muted-foreground">Manage your beats, track sales, and connect with artists.</p>
        </div>
        <Button onClick={() => navigate('/upload')}>
          <Plus className="w-4 h-4 mr-2" />
          Upload Beats
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Beat Packs</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{beatPacks.length}</div>
            <p className="text-xs text-muted-foreground">Active releases</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentMessages.length}</div>
            <p className="text-xs text-muted-foreground">Artist inquiries</p>
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

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Beat Pack Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Beat Pack Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {beatPacks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No beat packs yet</p>
            ) : (
              beatPacks.map((pack) => (
                <div key={pack.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Music className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium">{pack.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(pack.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">0</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">0</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Artist Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentMessages.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No recent messages</p>
            ) : (
              recentMessages.map((message) => (
                <div key={message.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {message.sender?.first_name} {message.sender?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{message.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(message.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

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
                      <p className="font-medium text-sm">{sale.beatPack}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sale.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">${sale.amount}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notifications.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No new notifications</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="p-3 rounded-lg border-l-4 border-l-primary bg-muted/50">
                  <p className="font-medium text-sm">{notification.title}</p>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notification.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Grow your producer business with these tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate('/upload')}>
              <Plus className="w-6 h-6" />
              Upload Beats
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <MessageSquare className="w-6 h-6" />
              Message Artists
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <BarChart3 className="w-6 h-6" />
              View Analytics
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <Users className="w-6 h-6" />
              Find Collaborators
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}