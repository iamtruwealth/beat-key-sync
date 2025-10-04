import { Card } from "@/components/ui/card";
import { Music } from "lucide-react";

interface EPKMusicPlayerModuleProps {
  module: any;
  themeSettings?: any;
}

export function EPKMusicPlayerModule({ module, themeSettings }: EPKMusicPlayerModuleProps) {
  return (
    <Card className="p-8">
      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        {module.custom_title || "Music"}
      </h2>
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Music player integration coming soon</p>
        <p className="text-sm text-muted-foreground mt-2">
          Support for Spotify, SoundCloud, and custom audio players
        </p>
      </div>
    </Card>
  );
}
