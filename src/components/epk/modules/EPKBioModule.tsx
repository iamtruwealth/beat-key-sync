import { Card } from "@/components/ui/card";

interface EPKBioModuleProps {
  module: any;
  themeSettings?: any;
}

export function EPKBioModule({ module, themeSettings }: EPKBioModuleProps) {
  const data = module.module_data || {};
  const content = data.content || "Artist biography goes here...";

  return (
    <Card className="p-8">
      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        {module.custom_title || "Biography"}
      </h2>
      <div className="prose prose-lg dark:prose-invert max-w-none">
        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </Card>
  );
}
