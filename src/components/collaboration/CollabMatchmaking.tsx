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
import { Plus, Search, Filter, Music, Clock, User, MessageSquare, Play } from 'lucide-react';

interface CollabRequest {
  id: string;
  title: string;
  description: string;
  looking_for: string;
  genre_tags: string[];
  sample_beat_url?: string;
  status: string;
  created_at: string;
  requester_id: string;
  profiles: {
    producer_name?: string;
    producer_logo_url?: string;
    verification_status?: string;
  };
  applications_count?: number;
}

export const CollabMatchmaking: React.FC = () => {
  const [requests, setRequests] = useState<CollabRequest[]>([]);
  const [myRequests, setMyRequests] = useState<CollabRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'my-requests'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    looking_for: '',
    genre_tags: [] as string[],
    sample_beat_url: ''
  });
  const { toast } = useToast();

  const popularGenres = ['Hip-Hop', 'Trap', 'R&B', 'Pop', 'Electronic', 'Rock', 'Jazz', 'Reggae'];

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      // Load public requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('collaboration_requests')
        .select(`
          *,
          profiles!collaboration_requests_requester_id_fkey(
            producer_name,
            producer_logo_url,
            verification_status
          )
        `)
        .eq('status', 'open')
        .neq('requester_id', user.user?.id || '')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Load user's own requests
      let myRequestsData = [];
      if (user.user) {
        const { data, error: myRequestsError } = await supabase
          .from('collaboration_requests')
          .select(`
            *,
            profiles!collaboration_requests_requester_id_fkey(
              producer_name,
              producer_logo_url,
              verification_status
            )
          `)
          .eq('requester_id', user.user.id)
          .order('created_at', { ascending: false });

        if (myRequestsError) throw myRequestsError;
        myRequestsData = data || [];
      }

      setRequests(requestsData || []);
      setMyRequests(myRequestsData);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast({
        title: "Error",
        description: "Failed to load collaboration requests",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('collaboration_requests')
        .insert({
          title: newRequest.title,
          description: newRequest.description,
          looking_for: newRequest.looking_for,
          genre_tags: newRequest.genre_tags,
          sample_beat_url: newRequest.sample_beat_url || null,
          requester_id: user.user.id,
          status: 'open',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Collaboration request posted successfully"
      });

      setShowCreateDialog(false);
      setNewRequest({
        title: '',
        description: '',
        looking_for: '',
        genre_tags: [],
        sample_beat_url: ''
      });
      loadRequests();
    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: "Error",
        description: "Failed to create collaboration request",
        variant: "destructive"
      });
    }
  };

  const applyToRequest = async (requestId: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('collaboration_applications')
        .insert({
          request_id: requestId,
          applicant_id: user.user.id,
          message: 'I\'d love to collaborate on this project!',
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Applied!",
        description: "Your application has been sent to the requester"
      });
    } catch (error) {
      console.error('Error applying to request:', error);
      toast({
        title: "Error",
        description: "Failed to apply to collaboration request",
        variant: "destructive"
      });
    }
  };

  const toggleGenreTag = (genre: string) => {
    setNewRequest(prev => ({
      ...prev,
      genre_tags: prev.genre_tags.includes(genre)
        ? prev.genre_tags.filter(g => g !== genre)
        : [...prev.genre_tags, genre]
    }));
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.looking_for.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = !selectedGenre || request.genre_tags.includes(selectedGenre);
    return matchesSearch && matchesGenre;
  });

  if (loading) {
    return (
      <GlassMorphismSection>
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading collaboration requests...</p>
        </div>
      </GlassMorphismSection>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-electric-blue">Find Collaborators</h2>
          <p className="text-muted-foreground">Discover and connect with producers looking to collaborate</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'browse' ? 'default' : 'outline'}
            onClick={() => setActiveTab('browse')}
            className={activeTab === 'browse' ? 'bg-electric-blue text-white' : ''}
          >
            Browse Requests
          </Button>
          <Button
            variant={activeTab === 'my-requests' ? 'default' : 'outline'}
            onClick={() => setActiveTab('my-requests')}
            className={activeTab === 'my-requests' ? 'bg-electric-blue text-white' : ''}
          >
            My Requests
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-electric-blue to-neon-magenta hover:from-electric-blue/80 hover:to-neon-magenta/80">
                <Plus className="w-4 h-4 mr-2" />
                Post Request
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background/95 backdrop-blur-xl border-electric-blue/30 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-electric-blue">Post Collaboration Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Request Title (e.g., 'Need R&B melodies for trap project')"
                  value={newRequest.title}
                  onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                  className="border-border/50 focus:border-electric-blue/50"
                />
                <Textarea
                  placeholder="Describe your project and what you're looking for..."
                  value={newRequest.description}
                  onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                  className="border-border/50 focus:border-electric-blue/50 h-24"
                />
                <Input
                  placeholder="What specifically are you looking for? (e.g., 'Trap Drum God', 'R&B Vocalist')"
                  value={newRequest.looking_for}
                  onChange={(e) => setNewRequest({ ...newRequest, looking_for: e.target.value })}
                  className="border-border/50 focus:border-electric-blue/50"
                />
                
                {/* Genre Tags */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Genre Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {popularGenres.map(genre => (
                      <Badge
                        key={genre}
                        variant={newRequest.genre_tags.includes(genre) ? 'default' : 'outline'}
                        className={`cursor-pointer transition-all ${
                          newRequest.genre_tags.includes(genre) 
                            ? 'bg-electric-blue text-white' 
                            : 'hover:bg-electric-blue/20'
                        }`}
                        onClick={() => toggleGenreTag(genre)}
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Input
                  placeholder="Sample Beat URL (Optional)"
                  value={newRequest.sample_beat_url}
                  onChange={(e) => setNewRequest({ ...newRequest, sample_beat_url: e.target.value })}
                  className="border-border/50 focus:border-electric-blue/50"
                />
                
                <Button 
                  onClick={createRequest}
                  className="w-full bg-gradient-to-r from-electric-blue to-neon-magenta"
                  disabled={!newRequest.title || !newRequest.description || !newRequest.looking_for}
                >
                  Post Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {activeTab === 'browse' && (
        <>
          {/* Search and Filters */}
          <GlassMorphismSection variant="gradient">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search collaboration requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-border/50 focus:border-electric-blue/50"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="px-3 py-2 bg-background/50 border border-border/50 rounded-md text-sm focus:border-electric-blue/50"
                >
                  <option value="">All Genres</option>
                  {popularGenres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>
            </div>
          </GlassMorphismSection>

          {/* Requests Grid */}
          {filteredRequests.length === 0 ? (
            <GlassMorphismSection>
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-electric-blue mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-electric-blue mb-2">No Requests Found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || selectedGenre 
                    ? 'Try adjusting your search criteria'
                    : 'Be the first to post a collaboration request!'
                  }
                </p>
              </div>
            </GlassMorphismSection>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRequests.map((request) => (
                <Card key={request.id} className="glass-morphism border-border/50 hover:border-electric-blue/50 transition-all duration-300 group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-lg text-electric-blue group-hover:text-neon-magenta transition-colors">
                        {request.title}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {request.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-electric-blue/20 to-neon-magenta/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-electric-blue">
                          {request.profiles?.producer_name?.[0] || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{request.profiles?.producer_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {request.description}
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-electric-blue" />
                        <span className="text-electric-blue font-medium">Looking for:</span>
                        <span>{request.looking_for}</span>
                      </div>
                      
                      {request.genre_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {request.genre_tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {request.genre_tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{request.genre_tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      {request.sample_beat_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-electric-blue/30 hover:bg-electric-blue/20"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Preview
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => applyToRequest(request.id)}
                        className="flex-1 bg-electric-blue/10 hover:bg-electric-blue/20 text-electric-blue border border-electric-blue/30"
                      >
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'my-requests' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myRequests.map((request) => (
            <Card key={request.id} className="glass-morphism border-border/50">
              <CardHeader>
                <CardTitle className="text-neon-cyan">{request.title}</CardTitle>
                <Badge className={request.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                  {request.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{request.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {request.applications_count || 0} applications
                  </span>
                  <Button size="sm" variant="outline">
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {myRequests.length === 0 && (
            <div className="col-span-full text-center py-12">
              <MessageSquare className="w-16 h-16 text-neon-cyan mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold text-neon-cyan mb-2">No Requests Posted</h3>
              <p className="text-muted-foreground">Post your first collaboration request to find producers</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};