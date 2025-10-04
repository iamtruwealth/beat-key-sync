import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Subscription {
  id: string;
  artist_id: string;
  tier_id: string;
  status: string;
  current_period_end: string;
  tier: {
    tier_name: string;
    price_cents: number;
  };
  artist: {
    producer_name: string;
    producer_logo_url: string;
  };
}

interface ExclusivePost {
  id: string;
  title: string;
  preview_text: string;
  preview_image_url: string;
  content: string;
  media_url: string;
  media_type: string;
  published_at: string;
  artist: {
    producer_name: string;
  };
}

export default function MySubscriptions() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [exclusiveContent, setExclusiveContent] = useState<ExclusivePost[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Load active subscriptions
      const { data: subs, error: subsError } = await supabase
        .from("fan_subscriptions")
        .select(`
          id,
          artist_id,
          tier_id,
          status,
          current_period_end,
          fan_subscription_tiers!inner(tier_name, price_cents),
          profiles!inner(producer_name, producer_logo_url)
        `)
        .eq("fan_id", user.id)
        .eq("status", "active");

      if (subsError) throw subsError;
      setSubscriptions((subs as any) || []);

      // Load exclusive content for subscribed artists
      const { data: posts, error: postsError } = await supabase
        .from("artist_exclusive_posts")
        .select(`
          id,
          title,
          preview_text,
          preview_image_url,
          content,
          media_url,
          media_type,
          published_at,
          profiles!inner(producer_name)
        `)
        .eq("is_published", true)
        .order("published_at", { ascending: false });

      if (postsError) throw postsError;
      setExclusiveContent((posts as any) || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open customer portal",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Subscriptions</h1>
        <p className="text-muted-foreground">
          Manage your artist subscriptions and access exclusive content
        </p>
      </div>

      {/* Active Subscriptions */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Crown className="w-6 h-6 text-primary" />
          Active Subscriptions
        </h2>
        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                You don't have any active subscriptions yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {subscriptions.map((sub: any) => (
              <Card key={sub.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {sub.profiles?.producer_logo_url && (
                        <img
                          src={sub.profiles.producer_logo_url}
                          alt={sub.profiles.producer_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <CardTitle>{sub.profiles?.producer_name}</CardTitle>
                        <CardDescription>
                          {sub.fan_subscription_tiers?.tier_name.replace("_", " ").toUpperCase()} • ${(sub.fan_subscription_tiers?.price_cents / 100).toFixed(2)}/mo
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                      {sub.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Renews: {new Date(sub.current_period_end).toLocaleDateString()}
                  </p>
                  <Button onClick={handleManageSubscription} variant="outline" className="w-full">
                    Manage Subscription
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Exclusive Content */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Lock className="w-6 h-6 text-primary" />
          Exclusive Content
        </h2>
        {exclusiveContent.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No exclusive content available yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {exclusiveContent.map((post: any) => (
              <Card key={post.id} className="overflow-hidden">
                {post.preview_image_url && (
                  <img
                    src={post.preview_image_url}
                    alt={post.title}
                    className="w-full h-48 object-cover"
                  />
                )}
                <CardHeader>
                  <CardTitle className="line-clamp-1">{post.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {post.preview_text}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {post.media_url && (
                      <div>
                        {post.media_type === "video" && (
                          <video controls className="w-full rounded-lg">
                            <source src={post.media_url} />
                          </video>
                        )}
                        {post.media_type === "audio" && (
                          <audio controls className="w-full">
                            <source src={post.media_url} />
                          </audio>
                        )}
                        {post.media_type === "image" && (
                          <img src={post.media_url} alt={post.title} className="w-full rounded-lg" />
                        )}
                      </div>
                    )}
                    <p className="text-sm">{post.content}</p>
                    <p className="text-xs text-muted-foreground">
                      Posted {new Date(post.published_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
