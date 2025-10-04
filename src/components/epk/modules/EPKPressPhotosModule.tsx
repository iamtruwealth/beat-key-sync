import { Card } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";

interface EPKPressPhotosModuleProps {
  module: any;
  themeSettings?: any;
}

export function EPKPressPhotosModule({ module, themeSettings }: EPKPressPhotosModuleProps) {
  const photos = module.module_data?.photos || [];

  return (
    <Card className="p-8">
      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        {module.custom_title || "Press Photos"}
      </h2>
      {photos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photoUrl: string, index: number) => (
            <div key={index} className="relative group overflow-hidden rounded-lg aspect-square">
              <img
                src={photoUrl}
                alt={`Press photo ${index + 1}`}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No press photos yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Upload high-resolution images for press and media
          </p>
        </div>
      )}
    </Card>
  );
}
