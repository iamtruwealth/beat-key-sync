import { Users, Share2, Eye, Download, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Shared() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Shared Projects</h1>
        <p className="text-muted-foreground">
          Projects shared with you by other producers and collaborators.
        </p>
      </div>

      <div className="text-center py-12 text-muted-foreground">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">No shared projects</h3>
        <p className="mb-4">When someone shares a project with you, it will appear here.</p>
        <Button variant="studio" disabled>
          <Share2 className="w-4 h-4" />
          Coming Soon
        </Button>
      </div>
    </div>
  );
}