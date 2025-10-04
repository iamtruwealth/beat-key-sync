import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, Save, Plus, Globe, Download } from "lucide-react";
import { AudioProvider } from "@/contexts/AudioContext";
import { EPKModuleList } from "@/components/epk/EPKModuleList";
import { EPKSettings } from "@/components/epk/EPKSettings";
import { FanSubscriptionManager } from "@/components/epk/FanSubscriptionManager";
import { ExclusiveContentManager } from "@/components/epk/ExclusiveContentManager";
import { WelcomeMessageManager } from "@/components/epk/WelcomeMessageManager";
import SubscriptionAnalytics from "@/components/epk/SubscriptionAnalytics";

export default function ArtistEPK() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [epkProfile, setEpkProfile] = useState<any>(null);
  const [slug, setSlug] = useState("");

  useEffect(() => {
    loadEPKProfile();
  }, []);

  const loadEPKProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("artist_epk_profiles")
        .select("*")
        .eq("artist_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setEpkProfile(data);
        setSlug(data.slug);
      }
    } catch (error: any) {
      console.error("Error loading EPK:", error);
      toast({
        title: "Error",
        description: "Failed to load EPK profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createEPK = async () => {
    if (!slug) {
      toast({
        title: "Slug Required",
        description: "Please enter a URL slug for your EPK",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("artist_epk_profiles")
        .insert({
          artist_id: user.id,
          slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          is_published: false,
        })
        .select()
        .single();

      if (error) throw error;

      setEpkProfile(data);
      toast({
        title: "EPK Created!",
        description: "Your artist EPK has been created successfully",
      });
    } catch (error: any) {
      console.error("Error creating EPK:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create EPK",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!epkProfile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("artist_epk_profiles")
        .update({ is_published: !epkProfile.is_published })
        .eq("id", epkProfile.id);

      if (error) throw error;

      setEpkProfile({ ...epkProfile, is_published: !epkProfile.is_published });
      toast({
        title: epkProfile.is_published ? "EPK Unpublished" : "EPK Published!",
        description: epkProfile.is_published
          ? "Your EPK is now private"
          : "Your EPK is now live and public",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update EPK status",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card className="p-8 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Create Your Artist EPK
            </h1>
            <p className="text-muted-foreground">
              Build your electronic press kit to showcase your music, connect with fans, and monetize your fanbase.
            </p>
            <div className="space-y-4">
              <div className="text-left">
                <label className="text-sm font-medium mb-2 block">Your EPK URL</label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 border border-r-0 rounded-l-md bg-muted text-muted-foreground text-sm">
                    beatpackz.com/epk/
                  </span>
                  <Input
                    placeholder="your-artist-name"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="flex-1 rounded-l-none"
                  />
                </div>
              </div>
              <Button
                onClick={createEPK}
                disabled={saving || !slug}
                size="lg"
                className="w-full bg-gradient-to-r from-primary to-accent"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create EPK
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <AudioProvider>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Artist EPK Studio
            </h1>
            <p className="text-muted-foreground mt-2">
              Your EPK URL: <span className="text-primary font-mono">beatpackz.com/epk/{epkProfile.slug}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open(`/epk/${epkProfile.slug}`, "_blank")}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={togglePublish} disabled={saving} className="bg-gradient-to-r from-primary to-accent">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              {epkProfile.is_published ? "Unpublish" : "Publish"}
            </Button>
          </div>
        </div>

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
            <EPKSettings epkProfile={epkProfile} onUpdate={setEpkProfile} />
          </TabsContent>
        </Tabs>
      </div>
    </AudioProvider>
  );
}
