import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface EPKSubscriptionTiersProps {
  tiers: any[];
  artistId: string;
  currentUser: any;
  activeSubscription: any;
}

export function EPKSubscriptionTiers({
  tiers,
  artistId,
  currentUser,
  activeSubscription,
}: EPKSubscriptionTiersProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubscribe = async (tier: any) => {
    if (!currentUser) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to subscribe",
      });
      navigate("/auth");
      return;
    }

    if (activeSubscription) {
      toast({
        title: "Already Subscribed",
        description: "You're already subscribed to this artist",
      });
      return;
    }

    // Call edge function to create Stripe checkout session
    try {
      const { data, error } = await supabase.functions.invoke("create-fan-subscription", {
        body: { tier_id: tier.id, artist_id: artistId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to start subscription checkout",
        variant: "destructive",
      });
    }
  };

  const getTierLabel = (tierName: string) => {
    const labels: Record<string, string> = {
      fan: "Fan",
      super_fan: "Super Fan",
      ultra_fan: "Ultra Fan",
    };
    return labels[tierName] || tierName;
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Support This Artist
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Get exclusive access to behind-the-scenes content, early releases, and connect directly with the artist
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier, index) => {
          const isActive = activeSubscription?.tier_id === tier.id;
          const isPopular = tier.tier_name === "super_fan";

          return (
            <Card
              key={tier.id}
              className={`relative p-6 ${
                isPopular
                  ? "border-2 border-primary shadow-lg shadow-primary/20 scale-105"
                  : ""
              } ${isActive ? "bg-primary/5 border-primary" : ""}`}
            >
              {isPopular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent">
                  <Star className="h-3 w-3 mr-1" />
                  Most Popular
                </Badge>
              )}

              {isActive && (
                <Badge className="absolute -top-3 right-4 bg-green-500">
                  Active
                </Badge>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{getTierLabel(tier.tier_name)}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">${(tier.price_cents / 100).toFixed(0)}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Artist earns ${((tier.price_cents * 0.88) / 100).toFixed(2)}/mo
                </p>
              </div>

              <ul className="space-y-3 mb-6">
                {tier.perks?.map((perk: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{perk}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(tier)}
                disabled={isActive}
                className={`w-full ${
                  isPopular
                    ? "bg-gradient-to-r from-primary to-accent"
                    : ""
                }`}
              >
                {isActive ? "Current Tier" : "Subscribe Now"}
              </Button>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        All subscriptions include a 12% platform fee • Cancel anytime
      </p>
    </div>
  );
}
