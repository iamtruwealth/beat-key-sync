import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";

interface TourDate {
  date: string;
  venue: string;
  city: string;
  ticket_url?: string;
}

interface EPKTourDatesModuleProps {
  data: {
    dates?: TourDate[];
  };
  customTitle?: string;
}

export function EPKTourDatesModule({ data, customTitle }: EPKTourDatesModuleProps) {
  const dates = data.dates || [];

  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">
          {customTitle || "Tour Dates"}
        </h2>
        <div className="space-y-4">
          {dates.map((date, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(date.date), "PPP")}</span>
                  </div>
                  <h3 className="text-xl font-semibold">{date.venue}</h3>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{date.city}</span>
                  </div>
                </div>
                {date.ticket_url && (
                  <Button asChild>
                    <a href={date.ticket_url} target="_blank" rel="noopener noreferrer">
                      Get Tickets
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
