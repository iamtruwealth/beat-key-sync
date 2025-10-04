import { Card } from "@/components/ui/card";

interface EPKVideoModuleProps {
  data: {
    video_url?: string;
    video_title?: string;
  };
  customTitle?: string;
}

export function EPKVideoModule({ data, customTitle }: EPKVideoModuleProps) {
  const getEmbedUrl = (url: string) => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const videoId = url.includes("youtu.be") 
        ? url.split("youtu.be/")[1]?.split("?")[0]
        : url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("vimeo.com")) {
      const videoId = url.split("vimeo.com/")[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  };

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">
          {customTitle || data.video_title || "Featured Video"}
        </h2>
        <Card className="overflow-hidden">
          <div className="relative pb-[56.25%]">
            <iframe
              src={getEmbedUrl(data.video_url || "")}
              className="absolute top-0 left-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </Card>
      </div>
    </section>
  );
}
