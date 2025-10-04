import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface EPKModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epkProfileId: string;
  editingModule: any;
  onSuccess: () => void;
}

const MODULE_TYPES = [
  { value: "header", label: "Header Banner" },
  { value: "bio", label: "Bio" },
  { value: "press_photos", label: "Press Photos" },
  { value: "music_player", label: "Music Player" },
  { value: "music_video", label: "Music Video" },
  { value: "achievements", label: "Achievements & Press" },
  { value: "performance_history", label: "Performance History" },
  { value: "social_stats", label: "Social Media Stats" },
  { value: "genre_tags", label: 'Genre / "For Fans Of"' },
  { value: "contact", label: "Contact / Booking" },
  { value: "sync_licensing", label: "Sync Licensing" },
  { value: "merch", label: "Merch Store" },
  { value: "testimonials", label: "Testimonials" },
];

export function EPKModuleDialog({
  open,
  onOpenChange,
  epkProfileId,
  editingModule,
  onSuccess,
}: EPKModuleDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [moduleType, setModuleType] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [moduleData, setModuleData] = useState<any>({});

  useEffect(() => {
    if (editingModule) {
      setModuleType(editingModule.module_type);
      setCustomTitle(editingModule.custom_title || "");
      setModuleData(editingModule.module_data || {});
    } else {
      setModuleType("");
      setCustomTitle("");
      setModuleData({});
    }
  }, [editingModule, open]);

  const handleSave = async () => {
    if (!moduleType) {
      toast({
        title: "Module Type Required",
        description: "Please select a module type",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingModule) {
        const { error } = await supabase
          .from("epk_modules")
          .update({
            custom_title: customTitle,
            module_data: moduleData,
          })
          .eq("id", editingModule.id);

        if (error) throw error;

        toast({
          title: "Module Updated",
          description: "Your EPK module has been updated",
        });
      } else {
        const { data: existingModules } = await supabase
          .from("epk_modules")
          .select("position")
          .eq("epk_profile_id", epkProfileId)
          .order("position", { ascending: false })
          .limit(1);

        const nextPosition = existingModules && existingModules.length > 0 ? existingModules[0].position + 1 : 0;

        const { error } = await supabase.from("epk_modules").insert({
          epk_profile_id: epkProfileId,
          module_type: moduleType,
          custom_title: customTitle,
          module_data: moduleData,
          position: nextPosition,
          is_enabled: true,
        });

        if (error) throw error;

        toast({
          title: "Module Added",
          description: "Your new EPK module has been added",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save module",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingModule ? "Edit Module" : "Add Module"}</DialogTitle>
          <DialogDescription>
            {editingModule ? "Update your EPK module content" : "Add a new module to your EPK"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="module-type">Module Type</Label>
            <Select value={moduleType} onValueChange={setModuleType} disabled={!!editingModule}>
              <SelectTrigger id="module-type">
                <SelectValue placeholder="Select a module type" />
              </SelectTrigger>
              <SelectContent>
                {MODULE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-title">Custom Title (Optional)</Label>
            <Input
              id="custom-title"
              placeholder="Override the default module title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
          </div>

          {moduleType === "bio" && (
            <div className="space-y-2">
              <Label htmlFor="bio-content">Bio Content</Label>
              <Textarea
                id="bio-content"
                placeholder="Write your artist bio..."
                value={moduleData.content || ""}
                onChange={(e) => setModuleData({ ...moduleData, content: e.target.value })}
                rows={6}
              />
            </div>
          )}

          {moduleType === "header" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="Your artist tagline"
                  value={moduleData.tagline || ""}
                  onChange={(e) => setModuleData({ ...moduleData, tagline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner-url">Banner Image URL</Label>
                <Input
                  id="banner-url"
                  placeholder="https://..."
                  value={moduleData.bannerUrl || ""}
                  onChange={(e) => setModuleData({ ...moduleData, bannerUrl: e.target.value })}
                />
              </div>
            </>
          )}

          <p className="text-sm text-muted-foreground">
            More detailed module configuration options coming soon!
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-primary to-accent">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editingModule ? "Update" : "Add"} Module
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
