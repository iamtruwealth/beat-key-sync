import { Card } from "@/components/ui/card";
import { Quote } from "lucide-react";

interface PressQuote {
  quote: string;
  source: string;
  publication?: string;
}

interface EPKPressQuotesModuleProps {
  data: {
    quotes?: PressQuote[];
  };
  customTitle?: string;
}

export function EPKPressQuotesModule({ data, customTitle }: EPKPressQuotesModuleProps) {
  const quotes = data.quotes || [];

  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">
          {customTitle || "Press & Reviews"}
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {quotes.map((quote, index) => (
            <Card key={index} className="p-6 relative">
              <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/20" />
              <blockquote className="space-y-4">
                <p className="text-lg italic">&quot;{quote.quote}&quot;</p>
                <footer className="text-sm">
                  <cite className="not-italic font-semibold">— {quote.source}</cite>
                  {quote.publication && (
                    <div className="text-muted-foreground">{quote.publication}</div>
                  )}
                </footer>
              </blockquote>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
