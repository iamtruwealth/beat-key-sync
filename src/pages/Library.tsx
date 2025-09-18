import { Search, Upload, Grid3X3, List, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Library() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Library</h1>
          <p className="text-muted-foreground">
            Browse and manage all your audio files and stems.
          </p>
        </div>
        
        <Button variant="producer">
          <Upload className="w-4 h-4" />
          Upload Audio
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by filename, BPM, key..."
              className="pl-10 bg-background/50 border-border/50"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </Button>
          <Button variant="ghost" size="sm">
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">All Files</Badge>
        <Badge variant="outline">Vocals</Badge>
        <Badge variant="outline">Drums</Badge>
        <Badge variant="outline">Bass</Badge>
        <Badge variant="outline">Melody</Badge>
        <Badge variant="outline">FX</Badge>
      </div>

      <div className="text-center py-12 text-muted-foreground">
        <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">No audio files yet</h3>
        <p className="mb-4">Upload your first audio file to get started with the library.</p>
        <Button variant="producer">Upload Audio Files</Button>
      </div>
    </div>
  );
}