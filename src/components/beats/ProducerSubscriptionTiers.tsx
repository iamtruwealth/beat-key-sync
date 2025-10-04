import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download } from "lucide-react";

interface ProducerSubscriptionTiersProps {
  producerId: string;
}

export function ProducerSubscriptionTiers({ producerId }: ProducerSubscriptionTiersProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<any[]>([]);

  useEffect(() => {
    loadSubscriptionTiers();
  }, [producerId]);

  const loadSubscriptionTiers = async () => {
    try {
      const { data: tiersData } = await supabase
        .from("producer_subscription_tiers")
        .select("*")
        .eq("producer_id", producerId)
        .eq("is_active", true)
        .order("price_cents");

      setTiers(tiersData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load subscription tiers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tierId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to subscribe to this producer",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Coming Soon",
        description: "Stripe payment integration coming in Phase 2",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to process subscription",
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
    return null;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Fan Subscriptions</h2>
        <p className="text-muted-foreground">
          Subscribe to get exclusive beats and perks from this producer
        </p>
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
            <div className="space-y-2 mb-6">
              <p className="text-sm font-semibold">Perks:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {tier.perks?.map((perk: string, idx: number) => (
                  <li key={idx}>• {perk}</li>
                ))}
              </ul>
            </div>
            <Button 
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
              onClick={() => handleSubscribe(tier.id)}
            >
              Subscribe
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
