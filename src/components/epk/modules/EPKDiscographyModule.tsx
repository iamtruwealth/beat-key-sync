import { Card } from "@/components/ui/card";

interface Release {
  title: string;
  year: number;
  cover_url?: string;
  spotify_url?: string;
}

interface EPKDiscographyModuleProps {
  data: {
    releases?: Release[];
  };
  customTitle?: string;
}

export function EPKDiscographyModule({ data, customTitle }: EPKDiscographyModuleProps) {
  const releases = data.releases || [];

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">
          {customTitle || "Discography"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {releases.map((release, index) => (
            <Card
              key={index}
              className="overflow-hidden hover:scale-105 transition-transform cursor-pointer"
              onClick={() => release.spotify_url && window.open(release.spotify_url, "_blank")}
            >
              <div className="aspect-square bg-muted relative">
                {release.cover_url ? (
                  <img
                    src={release.cover_url}
                    alt={release.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    No Cover
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold truncate">{release.title}</h3>
                <p className="text-sm text-muted-foreground">{release.year}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
