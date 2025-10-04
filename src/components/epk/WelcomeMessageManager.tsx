import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function WelcomeMessageManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<Record<string, any>>({
    fan: null,
    super_fan: null,
    ultra_fan: null,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("subscription_welcome_messages")
        .select("*")
        .eq("artist_id", user.id);

      if (error) throw error;

      const templatesMap: Record<string, any> = {};
      data?.forEach((template) => {
        templatesMap[template.tier_name] = template;
      });
      setTemplates(templatesMap);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load welcome messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (tierName: string, templateData: any) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("subscription_welcome_messages")
        .upsert({
          artist_id: user.id,
          tier_name: tierName,
          ...templateData,
        });

      if (error) throw error;

      toast({
        title: "Template Saved",
        description: "Welcome message template has been updated",
      });

      loadTemplates();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const TierTemplateForm = ({ tierName, tierLabel }: { tierName: string; tierLabel: string }) => {
    const template = templates[tierName];
    const [subject, setSubject] = useState(template?.subject || `Welcome to My Fan Club!`);
    const [messageBody, setMessageBody] = useState(
      template?.message_body || `Thank you for subscribing!`
    );
    const [includeDownloads, setIncludeDownloads] = useState(template?.include_download_links || false);
    const [downloadUrls, setDownloadUrls] = useState((template?.download_urls || []).join("\n"));

    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`subject-${tierName}`}>Email Subject</Label>
            <Input
              id={`subject-${tierName}`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Welcome to My Fan Club!"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`message-${tierName}`}>Welcome Message</Label>
            <Textarea
              id={`message-${tierName}`}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              rows={8}
              placeholder="Write your welcome message..."
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id={`downloads-${tierName}`}
              checked={includeDownloads}
              onCheckedChange={setIncludeDownloads}
            />
            <Label htmlFor={`downloads-${tierName}`}>Include Download Links</Label>
          </div>

          {includeDownloads && (
            <div className="space-y-2">
              <Label htmlFor={`urls-${tierName}`}>Download URLs (one per line)</Label>
              <Textarea
                id={`urls-${tierName}`}
                value={downloadUrls}
                onChange={(e) => setDownloadUrls(e.target.value)}
                rows={4}
                placeholder="https://..."
              />
            </div>
          )}

          <Button
            onClick={() =>
              handleSave(tierName, {
                subject,
                message_body: messageBody,
                include_download_links: includeDownloads,
                download_urls: downloadUrls.split("\n").filter((url) => url.trim()),
              })
            }
            disabled={saving}
            className="bg-gradient-to-r from-primary to-accent"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
            Save Template
          </Button>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Welcome Email Templates</h2>
        <p className="text-muted-foreground">
          Customize automated welcome emails sent to new subscribers for each tier
        </p>
      </div>

      <Tabs defaultValue="fan">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="fan">Fan ($4.99)</TabsTrigger>
          <TabsTrigger value="super_fan">Super Fan ($9.99)</TabsTrigger>
          <TabsTrigger value="ultra_fan">Ultra Fan ($24.99)</TabsTrigger>
        </TabsList>

        <TabsContent value="fan">
          <TierTemplateForm tierName="fan" tierLabel="Fan" />
        </TabsContent>

        <TabsContent value="super_fan">
          <TierTemplateForm tierName="super_fan" tierLabel="Super Fan" />
        </TabsContent>

        <TabsContent value="ultra_fan">
          <TierTemplateForm tierName="ultra_fan" tierLabel="Ultra Fan" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
