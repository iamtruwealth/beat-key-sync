import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GlassMorphismSection } from '@/components/futuristic/GlassMorphismSection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Music, Clock, DollarSign, Settings, Play, Zap } from 'lucide-react';

interface CollabProject {
  id: string;
  name: string;
  description: string;
  status: string;
  cover_art_url?: string;
  joint_artist_name?: string;
  created_by: string;
  workspace_type: string;
  target_genre?: string;
  target_bpm?: number;
  created_at: string;
  members: Array<{
    id: string;
    user_id: string;
    role: string;
    royalty_percentage: number;
    status: string;
    profiles: {
      producer_name?: string;
      producer_logo_url?: string;
    };
  }>;
}

export const CollabProjects: React.FC = () => {
  const [projects, setProjects] = useState<CollabProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    target_genre: '',
    target_bpm: '',
    joint_artist_name: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data: projectsData, error } = await supabase
        .from('collaboration_projects')
        .select(`
          *,
          members:collaboration_members(
            id,
            user_id,
            role,
            royalty_percentage,
            status,
            profiles(producer_name, producer_logo_url)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(projectsData || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "Error",
        description: "Failed to load collaboration projects",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('collaboration_projects')
        .insert({
          name: newProject.name,
          description: newProject.description,
          target_genre: newProject.target_genre || null,
          target_bpm: newProject.target_bpm ? parseInt(newProject.target_bpm) : null,
          joint_artist_name: newProject.joint_artist_name || null,
          created_by: user.user.id,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as first member
      await supabase
        .from('collaboration_members')
        .insert({
          collaboration_id: data.id,
          user_id: user.user.id,
          role: 'creator',
          royalty_percentage: 100,
          status: 'accepted'
        });

      toast({
        title: "Success!",
        description: "Collaboration project created successfully"
      });

      setShowCreateDialog(false);
      setNewProject({
        name: '',
        description: '',
        target_genre: '',
        target_bpm: '',
        joint_artist_name: ''
      });
      loadProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create collaboration project",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-500/20 text-yellow-400';
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'completed': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <GlassMorphismSection>
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading collaboration projects...</p>
        </div>
      </GlassMorphismSection>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neon-cyan">My Collaborations</h2>
          <p className="text-muted-foreground">Manage your active and past collaboration projects</p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan/80 hover:to-electric-blue/80">
              <Plus className="w-4 h-4 mr-2" />
              New Collaboration
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-background/95 backdrop-blur-xl border-neon-cyan/30">
            <DialogHeader>
              <DialogTitle className="text-neon-cyan">Create New Collaboration</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Project Name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="border-border/50 focus:border-neon-cyan/50"
              />
              <Textarea
                placeholder="Project Description"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="border-border/50 focus:border-neon-cyan/50"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Target Genre"
                  value={newProject.target_genre}
                  onChange={(e) => setNewProject({ ...newProject, target_genre: e.target.value })}
                  className="border-border/50 focus:border-neon-cyan/50"
                />
                <Input
                  placeholder="Target BPM"
                  type="number"
                  value={newProject.target_bpm}
                  onChange={(e) => setNewProject({ ...newProject, target_bpm: e.target.value })}
                  className="border-border/50 focus:border-neon-cyan/50"
                />
              </div>
              <Input
                placeholder="Joint Artist Name (Optional)"
                value={newProject.joint_artist_name}
                onChange={(e) => setNewProject({ ...newProject, joint_artist_name: e.target.value })}
                className="border-border/50 focus:border-neon-cyan/50"
              />
              <Button 
                onClick={createProject}
                className="w-full bg-gradient-to-r from-neon-cyan to-electric-blue"
                disabled={!newProject.name || !newProject.description}
              >
                Create Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <GlassMorphismSection>
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-neon-cyan mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold text-neon-cyan mb-2">No Collaborations Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start your first collaboration project and connect with other producers
            </p>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-neon-cyan to-electric-blue"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Collab
            </Button>
          </div>
        </GlassMorphismSection>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="glass-morphism border-border/50 hover:border-neon-cyan/50 transition-all duration-300 group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg text-neon-cyan group-hover:text-electric-blue transition-colors">
                      {project.name}
                    </CardTitle>
                    {project.joint_artist_name && (
                      <p className="text-sm text-muted-foreground">as {project.joint_artist_name}</p>
                    )}
                  </div>
                  <Badge className={getStatusColor(project.status)}>
                    {project.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {project.target_genre && (
                    <div className="flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      {project.target_genre}
                    </div>
                  )}
                  {project.target_bpm && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {project.target_bpm} BPM
                    </div>
                  )}
                </div>

                {/* Members */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-neon-cyan" />
                    <span className="text-sm text-muted-foreground">
                      {project.members?.length || 0} Members
                    </span>
                  </div>
                  <div className="flex -space-x-2">
                    {project.members?.slice(0, 3).map((member) => (
                      <div
                        key={member.id}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan/20 to-electric-blue/20 border-2 border-background flex items-center justify-center"
                      >
                        <span className="text-xs font-semibold text-neon-cyan">
                          {member.profiles?.producer_name?.[0] || '?'}
                        </span>
                      </div>
                    ))}
                    {(project.members?.length || 0) > 3 && (
                      <div className="w-8 h-8 rounded-full bg-background border-2 border-neon-cyan/30 flex items-center justify-center">
                        <span className="text-xs text-neon-cyan">+{(project.members?.length || 0) - 3}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Manage
                  </Button>
                  {project.status === 'active' && (
                    <Button
                      size="sm"
                      className="bg-electric-blue/10 hover:bg-electric-blue/20 text-electric-blue border border-electric-blue/30"
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      Cook
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};