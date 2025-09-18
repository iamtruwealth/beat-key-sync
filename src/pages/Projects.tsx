import { Search, Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Projects() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Beat Packs</h1>
          <p className="text-muted-foreground">
            Create and organize beat packs to showcase your production style.
          </p>
        </div>
        
        <Button variant="producer">
          <Plus className="w-4 h-4" />
          New Beat Pack
        </Button>
      </div>

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search beat packs..."
            className="pl-10 bg-background/50 border-border/50"
          />
        </div>
      </div>

      <div className="text-center py-12 text-muted-foreground">
        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">No beat packs yet</h3>
        <p className="mb-4">Create your first beat pack to showcase your production style.</p>
        <Button variant="producer">Create Beat Pack</Button>
      </div>
    </div>
  );
}