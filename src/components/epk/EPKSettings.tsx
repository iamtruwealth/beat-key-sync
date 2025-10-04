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
        <h2 className="text-2xl font-bold mb-4">EPK URL</h2>
        <p className="text-muted-foreground mb-4">
          Your public EPK URL: <a href={`/epk/${epkProfile.slug}`} target="_blank" rel="noopener noreferrer" className="text-primary font-mono hover:underline">beatpackz.store/epk/{epkProfile.slug}</a>
        </p>
        <p className="text-sm text-muted-foreground">
          Custom domain support coming soon!
        </p>
      </Card>
    </div>
  );
}
