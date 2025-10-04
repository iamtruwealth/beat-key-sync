import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, Users, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsData {
  totalSubscribers: number;
  activeSubscribers: number;
  monthlyRecurringRevenue: number;
  lifetimeEarnings: number;
  recentSubscribers: Array<{
    fan_id: string;
    tier_name: string;
    created_at: string;
  }>;
  revenueByTier: Array<{
    tier_name: string;
    subscriber_count: number;
    revenue: number;
  }>;
}

export default function SubscriptionAnalytics() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get active subscriptions
      const { data: subscriptions, error: subsError } = await supabase
        .from("fan_subscriptions")
        .select(`
          id,
          fan_id,
          created_at,
          tier_id,
          fan_subscription_tiers!inner(tier_name, price_cents)
        `)
        .eq("artist_id", user.id)
        .eq("status", "active");

      if (subsError) throw subsError;

      // Get payment history
      const { data: payments, error: paymentsError } = await supabase
        .from("fan_subscription_payments")
        .select("artist_earnings_cents, payment_date")
        .eq("artist_id", user.id);

      if (paymentsError) throw paymentsError;

      // Calculate analytics
      const activeSubscribers = subscriptions?.length || 0;
      
      // Calculate MRR
      const mrr = subscriptions?.reduce((sum, sub: any) => {
        return sum + (sub.fan_subscription_tiers?.price_cents || 0);
      }, 0) || 0;

      // Calculate lifetime earnings
      const lifetimeEarnings = payments?.reduce((sum, payment) => {
        return sum + payment.artist_earnings_cents;
      }, 0) || 0;

      // Recent subscribers (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentSubscribers = subscriptions?.filter(sub => 
        new Date(sub.created_at) > sevenDaysAgo
      ).map((sub: any) => ({
        fan_id: sub.fan_id,
        tier_name: sub.fan_subscription_tiers?.tier_name || "Unknown",
        created_at: sub.created_at,
      })) || [];

      // Revenue by tier
      const tierMap = new Map<string, { count: number; revenue: number }>();
      subscriptions?.forEach((sub: any) => {
        const tierName = sub.fan_subscription_tiers?.tier_name || "Unknown";
        const existing = tierMap.get(tierName) || { count: 0, revenue: 0 };
        tierMap.set(tierName, {
          count: existing.count + 1,
          revenue: existing.revenue + (sub.fan_subscription_tiers?.price_cents || 0),
        });
      });

      const revenueByTier = Array.from(tierMap.entries()).map(([tier_name, data]) => ({
        tier_name,
        subscriber_count: data.count,
        revenue: data.revenue,
      }));

      setAnalytics({
        totalSubscribers: activeSubscribers,
        activeSubscribers,
        monthlyRecurringRevenue: mrr,
        lifetimeEarnings,
        recentSubscribers,
        revenueByTier,
      });
    } catch (error: any) {
      toast({
        title: "Error loading analytics",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.activeSubscribers}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.recentSubscribers.length} new this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(analytics.monthlyRecurringRevenue / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">MRR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(analytics.lifetimeEarnings / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total earnings from subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Revenue Per User</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analytics.activeSubscribers > 0 
                ? (analytics.monthlyRecurringRevenue / analytics.activeSubscribers / 100).toFixed(2)
                : "0.00"
              }
            </div>
            <p className="text-xs text-muted-foreground">Per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Tier */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Tier</CardTitle>
          <CardDescription>Breakdown of subscribers and revenue by tier</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.revenueByTier.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No tier data available</p>
          ) : (
            <div className="space-y-4">
              {analytics.revenueByTier.map((tier) => (
                <div key={tier.tier_name} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{tier.tier_name.replace("_", " ").toUpperCase()}</p>
                    <p className="text-sm text-muted-foreground">
                      {tier.subscriber_count} subscriber{tier.subscriber_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${(tier.revenue / 100).toFixed(2)}/mo</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Subscribers */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Subscribers</CardTitle>
          <CardDescription>New subscriptions in the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.recentSubscribers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No new subscribers this week</p>
          ) : (
            <div className="space-y-3">
              {analytics.recentSubscribers.map((sub, index) => (
                <div key={index} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      {sub.tier_name.replace("_", " ").toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
