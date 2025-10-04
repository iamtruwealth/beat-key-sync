import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, ArrowLeft } from "lucide-react";
import { AudioProvider } from "@/contexts/AudioContext";
import { EPKHeaderModule } from "@/components/epk/modules/EPKHeaderModule";
import { EPKBioModule } from "@/components/epk/modules/EPKBioModule";
import { EPKMusicPlayerModule } from "@/components/epk/modules/EPKMusicPlayerModule";
import { EPKPressPhotosModule } from "@/components/epk/modules/EPKPressPhotosModule";
import { EPKVideoModule } from "@/components/epk/modules/EPKVideoModule";
import { EPKTourDatesModule } from "@/components/epk/modules/EPKTourDatesModule";
import { EPKDiscographyModule } from "@/components/epk/modules/EPKDiscographyModule";
import { EPKPressQuotesModule } from "@/components/epk/modules/EPKPressQuotesModule";
import { EPKSubscriptionTiers } from "@/components/epk/EPKSubscriptionTiers";

export default function PublicEPK() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [epkProfile, setEpkProfile] = useState<any>(null);
  const [artistProfile, setArtistProfile] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [subscriptionTiers, setSubscriptionTiers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeSubscription, setActiveSubscription] = useState<any>(null);

  useEffect(() => {
    loadEPK();
    checkUserSubscription();
  }, [slug]);

  const loadEPK = async () => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("artist_epk_profiles")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (profileError || !profile) {
        toast({
          title: "EPK Not Found",
          description: "This artist EPK doesn't exist or is not published",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setEpkProfile(profile);

      // Fetch artist profile data
      const { data: artistData } = await supabase
        .from("profiles")
        .select("artist_name, username, producer_name")
        .eq("id", profile.artist_id)
        .single();

      setArtistProfile(artistData);

      const { data: modulesData } = await supabase
        .from("epk_modules")
        .select("*")
        .eq("epk_profile_id", profile.id)
        .eq("is_enabled", true)
        .order("position");

      setModules(modulesData || []);

      const { data: tiersData } = await supabase
        .from("fan_subscription_tiers")
        .select("*")
        .eq("artist_id", profile.artist_id)
        .eq("is_active", true)
        .order("price_cents");

      setSubscriptionTiers(tiersData || []);
    } catch (error: any) {
      console.error("Error loading EPK:", error);
      toast({
        title: "Error",
        description: "Failed to load EPK",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkUserSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (!user) return;

      const { data: profile } = await supabase
        .from("artist_epk_profiles")
        .select("artist_id")
        .eq("slug", slug)
        .single();

      if (!profile) return;

      const { data: subscription } = await supabase
        .from("fan_subscriptions")
        .select("*, fan_subscription_tiers(*)")
        .eq("fan_id", user.id)
        .eq("artist_id", profile.artist_id)
        .eq("status", "active")
        .single();

      setActiveSubscription(subscription);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const renderModule = (module: any) => {
    const artistName = artistProfile?.artist_name || artistProfile?.username || artistProfile?.producer_name || "Artist";
    
    const commonProps = {
      module,
      themeSettings: epkProfile?.theme_settings,
      artistName,
    };

    switch (module.module_type) {
      case "header":
        return <EPKHeaderModule key={module.id} {...commonProps} />;
      case "bio":
        return <EPKBioModule key={module.id} {...commonProps} />;
      case "music_player":
        return <EPKMusicPlayerModule key={module.id} {...commonProps} />;
      case "press_photos":
        return <EPKPressPhotosModule key={module.id} {...commonProps} />;
      case "video":
        return <EPKVideoModule key={module.id} data={module.module_data} customTitle={module.custom_title} />;
      case "tour_dates":
        return <EPKTourDatesModule key={module.id} data={module.module_data} customTitle={module.custom_title} />;
      case "discography":
        return <EPKDiscographyModule key={module.id} data={module.module_data} customTitle={module.custom_title} />;
      case "press_quotes":
        return <EPKPressQuotesModule key={module.id} data={module.module_data} customTitle={module.custom_title} />;
      default:
        return (
          <Card key={module.id} className="p-6">
            <h3 className="text-xl font-bold mb-2">
              {module.custom_title || module.module_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </h3>
            <p className="text-muted-foreground">Module content coming soon</p>
          </Card>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!epkProfile) {
    return null;
  }

  const primaryColor = epkProfile.theme_settings?.primaryColor || "#8B5CF6";
  const accentColor = epkProfile.theme_settings?.accentColor || "#EC4899";

  return (
    <AudioProvider>
      <div className="min-h-screen bg-background">
        <style>
          {`
            :root {
              --epk-primary: ${primaryColor};
              --epk-accent: ${accentColor};
            }
          `}
        </style>

        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <Button
            variant="ghost"
            className="mb-6"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          {activeSubscription && (
            <Card className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    You're a {activeSubscription.fan_subscription_tiers?.tier_name.replace("_", " ")} subscriber!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Access to exclusive content and perks
                  </p>
                </div>
                <Badge className="capitalize">
                  {activeSubscription.fan_subscription_tiers?.tier_name.replace("_", " ")}
                </Badge>
              </div>
            </Card>
          )}

          <div className="space-y-8">
            {modules.map((module) => renderModule(module))}
          </div>

          {subscriptionTiers.length > 0 && (
            <div className="mt-16">
              <EPKSubscriptionTiers
                tiers={subscriptionTiers}
                artistId={epkProfile.artist_id}
                currentUser={currentUser}
                activeSubscription={activeSubscription}
              />
            </div>
          )}
        </div>
      </div>
    </AudioProvider>
  );
}
