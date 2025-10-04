import { Card } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";

interface EPKPressPhotosModuleProps {
  module: any;
  themeSettings?: any;
}

export function EPKPressPhotosModule({ module, themeSettings }: EPKPressPhotosModuleProps) {
  return (
    <Card className="p-8">
      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        {module.custom_title || "Press Photos"}
      </h2>
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Press photo gallery coming soon</p>
        <p className="text-sm text-muted-foreground mt-2">
          Upload high-resolution images for press and media
        </p>
      </div>
    </Card>
  );
}
