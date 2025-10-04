import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign, Users, TrendingUp, Download } from "lucide-react";

const DEFAULT_TIERS = [
  {
    tier_name: "bronze",
    price_cents: 2500,
    monthly_download_limit: 1,
    perks: ["1 exclusive beat download per month", "Early access to new releases"],
  },
  {
    tier_name: "silver",
    price_cents: 5000,
    monthly_download_limit: 2,
    perks: ["2 exclusive beat downloads per month", "Behind-the-scenes content", "Priority support"],
  },
  {
    tier_name: "gold",
    price_cents: 10000,
    monthly_download_limit: 5,
    perks: ["5 exclusive beat downloads per month", "Exclusive stems access", "Monthly Q&A", "Custom requests"],
  },
  {
    tier_name: "platinum",
    price_cents: 25000,
    monthly_download_limit: 8,
    perks: ["8 exclusive beat downloads per month", "All Gold perks", "VIP livestream access", "Personal consultations"],
  },
];

export function ProducerSubscriptionManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [revenue, setRevenue] = useState({ monthly: 0, lifetime: 0 });

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tiersData } = await supabase
        .from("producer_subscription_tiers")
        .select("*")
        .eq("producer_id", user.id)
        .order("price_cents");

      const { data: subsData } = await supabase
        .from("producer_subscriptions")
        .select("*, producer_subscription_tiers(*)")
        .eq("producer_id", user.id)
        .eq("status", "active");

      const { data: paymentsData } = await supabase
        .from("producer_subscription_payments")
        .select("producer_earnings_cents")
        .eq("producer_id", user.id);

      setTiers(tiersData || []);
      setSubscribers(subsData || []);

      if (paymentsData) {
        const lifetimeEarnings = paymentsData.reduce((sum, p) => sum + p.producer_earnings_cents, 0);
        setRevenue({
          lifetime: lifetimeEarnings,
          monthly: subsData?.reduce((sum, s) => {
            const tierPrice = s.producer_subscription_tiers?.price_cents || 0;
            return sum + Math.floor(tierPrice * 0.88);
          }, 0) || 0,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load subscription data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeTiers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tiersToCreate = DEFAULT_TIERS.map((tier) => ({
        ...tier,
        producer_id: user.id,
        is_active: true,
      }));

      const { error } = await supabase.from("producer_subscription_tiers").insert(tiersToCreate);

      if (error) throw error;

      toast({
        title: "Tiers Created",
        description: "Your fan subscription tiers are now active",
      });

      loadSubscriptionData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to initialize subscription tiers",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tiers.length === 0) {
    return (
      <Card className="p-8 text-center border-2 border-dashed">
        <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-bold mb-2">Fan Subscriptions Not Set Up</h3>
        <p className="text-muted-foreground mb-6">
          Enable recurring revenue by offering exclusive beats to your fans
        </p>
        <Button onClick={initializeTiers} className="bg-gradient-to-r from-primary to-accent">
          Enable Fan Subscriptions
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Monthly Recurring</h3>
          </div>
          <p className="text-3xl font-bold">${(revenue.monthly / 100).toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">After 12% platform fee</p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-accent/5 to-primary/5 border-accent/20">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-accent" />
            <h3 className="font-semibold">Lifetime Earnings</h3>
          </div>
          <p className="text-3xl font-bold">${(revenue.lifetime / 100).toFixed(2)}</p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Active Subscribers</h3>
          </div>
          <p className="text-3xl font-bold">{subscribers.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className="p-6 border-2 hover:border-primary/50 transition-colors"
          >
            <Badge className="mb-4 capitalize">{tier.tier_name}</Badge>
            <p className="text-3xl font-bold mb-1">${(tier.price_cents / 100).toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mb-4">per month</p>
            <div className="flex items-center gap-2 mb-4 text-accent">
              <Download className="h-4 w-4" />
              <span className="font-semibold">{tier.monthly_download_limit} beats/month</span>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Perks:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {tier.perks?.map((perk: string, idx: number) => (
                  <li key={idx}>• {perk}</li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              You earn ${((tier.price_cents * 0.88) / 100).toFixed(2)}/mo per subscriber
            </p>
          </Card>
        ))}
      </div>

      {subscribers.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-4">Active Subscribers</h3>
          <div className="space-y-3">
            {subscribers.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-semibold">Subscriber #{sub.fan_id.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {sub.producer_subscription_tiers?.tier_name} Tier
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Downloads: {sub.downloads_used}/{sub.producer_subscription_tiers?.monthly_download_limit}
                  </p>
                </div>
                <Badge>{sub.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-sm text-muted-foreground text-center">
        Stripe integration and payment processing setup coming in Phase 2
      </p>
    </div>
  );
}
