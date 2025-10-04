interface EPKHeaderModuleProps {
  module: any;
  themeSettings?: any;
}

export function EPKHeaderModule({ module, themeSettings }: EPKHeaderModuleProps) {
  const data = module.module_data || {};
  const bannerUrl = data.bannerUrl || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200";
  const tagline = data.tagline || "Electronic Press Kit";

  return (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden mb-8">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bannerUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {module.custom_title || "Artist Name"}
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">{tagline}</p>
      </div>
    </div>
  );
}
