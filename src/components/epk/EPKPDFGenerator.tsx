import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

interface EPKPDFGeneratorProps {
  epkData: {
    profile: any;
    modules: any[];
  };
}

export function EPKPDFGenerator({ epkData }: EPKPDFGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      let yPos = 20;

      // Header
      doc.setFontSize(24);
      doc.text(epkData.profile.producer_name || "Artist EPK", 20, yPos);
      yPos += 15;

      // Bio
      const bioModule = epkData.modules.find((m) => m.module_type === "bio");
      if (bioModule?.module_data?.bio_content) {
        doc.setFontSize(16);
        doc.text("Biography", 20, yPos);
        yPos += 10;
        doc.setFontSize(11);
        const bioLines = doc.splitTextToSize(bioModule.module_data.bio_content, 170);
        doc.text(bioLines, 20, yPos);
        yPos += bioLines.length * 7 + 10;
      }

      // Genres
      if (epkData.profile.genres?.length > 0) {
        doc.setFontSize(14);
        doc.text("Genres", 20, yPos);
        yPos += 8;
        doc.setFontSize(11);
        doc.text(epkData.profile.genres.join(", "), 20, yPos);
        yPos += 15;
      }

      // Social Links
      if (epkData.profile.social_links) {
        doc.setFontSize(14);
        doc.text("Links", 20, yPos);
        yPos += 8;
        doc.setFontSize(11);
        Object.entries(epkData.profile.social_links).forEach(([key, value]) => {
          if (value && yPos < 280) {
            doc.text(`${key}: ${value}`, 20, yPos);
            yPos += 7;
          }
        });
      }

      // Footer
      doc.setFontSize(10);
      doc.text(`Generated from BeatPackz EPK - ${new Date().toLocaleDateString()}`, 20, 280);

      // Save PDF
      doc.save(`${epkData.profile.producer_name || "artist"}-epk-onesheet.pdf`);

      toast({
        title: "PDF Generated",
        description: "Your EPK one-sheet has been downloaded",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={generating}
      variant="outline"
      className="gap-2"
    >
      {generating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Download One-Sheet PDF
    </Button>
  );
}
