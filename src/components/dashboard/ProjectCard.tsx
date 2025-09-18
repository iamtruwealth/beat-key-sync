import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Share2, MoreHorizontal, Clock, Music2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    bpm: number;
    key: string;
    stems: number;
    lastModified: string;
    duration: string;
    collaborators: number;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Card className="group hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
              {project.name}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {project.stems} stems • {project.collaborators} collaborators
            </CardDescription>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Open Project</DropdownMenuItem>
              <DropdownMenuItem>Share</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-primary/30 text-primary">
              {project.key}
            </Badge>
            <Badge variant="outline" className="border-secondary/30 text-secondary">
              {project.bpm} BPM
            </Badge>
          </div>
          
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="w-3 h-3" />
            {project.duration}
          </div>
        </div>
        
        {/* Waveform Placeholder */}
        <div className="h-16 bg-muted/30 rounded-md relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-primary/40 rounded-full"
                  style={{
                    height: `${Math.random() * 40 + 10}px`,
                    opacity: Math.random() * 0.7 + 0.3,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            Modified {project.lastModified}
          </span>
          
          <div className="flex items-center gap-2">
            <Button variant="waveform" size="sm">
              <Play className="w-3 h-3" />
              Play
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="w-3 h-3" />
              Share
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}