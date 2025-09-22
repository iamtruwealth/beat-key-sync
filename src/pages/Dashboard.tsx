import { Search, Plus, Filter, Music, Users, Clock, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { MetaTags } from "@/components/MetaTags";

// Mock data for demonstration
const mockProjects = [
  {
    id: "1",
    name: "Summer Vibes",
    bpm: 128,
    key: "C Major",
    stems: 8,
    lastModified: "2 hours ago",
    duration: "3:42",
    collaborators: 2,
  },
  {
    id: "2",
    name: "Dark Synthwave",
    bpm: 140,
    key: "A Minor",
    stems: 12,
    lastModified: "1 day ago",
    duration: "4:15",
    collaborators: 1,
  },
  {
    id: "3",
    name: "Lo-Fi Beats",
    bpm: 85,
    key: "F Major",
    stems: 6,
    lastModified: "3 days ago",
    duration: "2:58",
    collaborators: 3,
  },
  {
    id: "4",
    name: "Electronic Dreams",
    bpm: 132,
    key: "E Minor",
    stems: 10,
    lastModified: "1 week ago",
    duration: "5:21",
    collaborators: 2,
  },
];

const stats = [
  {
    title: "Total Projects",
    value: 24,
    description: "Active projects",
    icon: FolderOpen,
    trend: { value: 12, isPositive: true },
  },
  {
    title: "Audio Files",
    value: 156,
    description: "Stems uploaded",
    icon: Music,
    trend: { value: 8, isPositive: true },
  },
  {
    title: "Collaborators",
    value: 8,
    description: "Active this month",
    icon: Users,
    trend: { value: 2, isPositive: true },
  },
  {
    title: "Beat Packs",
    value: "47h",
    description: "This week",
    icon: Clock,
    trend: { value: 15, isPositive: true },
  },
];

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <MetaTags 
        title="Dashboard | BeatPackz - Manage Your Music Production"
        description="Access your BeatPackz dashboard to upload beats, manage projects, track performance, and connect with collaborators. Your central hub for music production."
        image="/assets/beat-packz-social-image.png"
      />
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your music projects.
          </p>
        </div>
        
        <Button variant="producer" size="lg">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search projects, stems, or collaborators..."
              className="pl-10 bg-background/50 border-border/50"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Recent Projects</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-2">Upload Stems</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload new audio files and organize them into projects.
          </p>
          <Button variant="producer" size="sm">
            Upload Files
          </Button>
        </div>
        
        <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-2">Collaborate</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Share your projects with other producers and get feedback.
          </p>
          <Button variant="studio" size="sm">
            Invite Producer
          </Button>
        </div>
        
        <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-border/20 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-2">Explore Library</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Browse your complete library of stems and projects.
          </p>
          <Button variant="waveform" size="sm">
            Browse Library
          </Button>
        </div>
      </div>
    </div>
  );
}