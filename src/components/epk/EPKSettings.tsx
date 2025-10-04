import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface EPKSettingsProps {
  epkProfile: any;
  onUpdate: (profile: any) => void;
}

export function EPKSettings({ epkProfile, onUpdate }: EPKSettingsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(
    epkProfile.theme_settings?.primaryColor || "#8B5CF6"
  );
  const [accentColor, setAccentColor] = useState(
    epkProfile.theme_settings?.accentColor || "#EC4899"
  );
  const [customDomain, setCustomDomain] = useState(
    epkProfile.custom_domain || ""
  );
  const [savingDomain, setSavingDomain] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("artist_epk_profiles")
        .update({
          theme_settings: {
            primaryColor,
            accentColor,
          },
        })
        .eq("id", epkProfile.id)
        .select()
        .single();

      if (error) throw error;

      onUpdate(data);
      toast({
        title: "Settings Saved",
        description: "Your EPK settings have been updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDomain = async () => {
    setSavingDomain(true);
    try {
      // Basic domain validation
      const cleanDomain = customDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      if (cleanDomain && !/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(cleanDomain)) {
        toast({
          title: "Invalid Domain",
          description: "Please enter a valid domain name (e.g., epk.yourdomain.com)",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("artist_epk_profiles")
        .update({
          custom_domain: cleanDomain || null,
        })
        .eq("id", epkProfile.id)
        .select()
        .single();

      if (error) throw error;

      onUpdate(data);
      toast({
        title: cleanDomain ? "Custom Domain Saved" : "Custom Domain Removed",
        description: cleanDomain 
          ? "Don't forget to configure your DNS records!" 
          : "Your custom domain has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save custom domain",
        variant: "destructive",
      });
    } finally {
      setSavingDomain(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Theme Settings</h2>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent-color">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="accent-color"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-primary to-accent">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Settings
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">EPK URL</h2>
        
        <div className="space-y-6">
          <div>
            <Label className="text-sm font-semibold">Default URL</Label>
            <p className="text-muted-foreground mt-2">
              <a href={`/epk/${epkProfile.slug}`} target="_blank" rel="noopener noreferrer" className="text-primary font-mono hover:underline">
                beatpackz.store/epk/{epkProfile.slug}
              </a>
            </p>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Custom Domain</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-domain">Your Custom Domain</Label>
                <Input
                  id="custom-domain"
                  placeholder="epk.yourdomain.com or yourdomain.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your domain (e.g., epk.yourdomain.com)
                </p>
              </div>

              <Button 
                onClick={handleSaveDomain} 
                disabled={savingDomain}
                variant="outline"
              >
                {savingDomain ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Custom Domain
              </Button>

              {customDomain && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm">DNS Setup Instructions</h4>
                  <p className="text-sm text-muted-foreground">
                    Add these DNS records at your domain registrar:
                  </p>
                  
                  <div className="space-y-2 font-mono text-xs">
                    <div className="bg-background rounded p-3 border">
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="col-span-2">CNAME</span>
                        <span className="text-muted-foreground">Name:</span>
                        <span className="col-span-2">{customDomain.replace(/^https?:\/\//, '').replace('www.', '')}</span>
                        <span className="text-muted-foreground">Value:</span>
                        <span className="col-span-2">beatpackz.store</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>⏱️ DNS changes can take up to 24-48 hours to propagate</p>
                    <p>🔒 SSL certificate will be automatically provisioned</p>
                    <p>📧 Contact support if you need help setting this up</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
