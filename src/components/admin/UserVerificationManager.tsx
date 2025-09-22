import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ShieldCheck, Search, Filter, User, Headphones } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  producer_name: string;
  first_name: string;
  last_name: string;
  producer_logo_url: string;
  verification_status: string;
  role: 'artist' | 'producer';
  created_at: string;
  public_profile_enabled: boolean;
}

export function UserVerificationManager() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    filterProfiles();
  }, [profiles, searchTerm, filterRole, filterStatus]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_profiles_for_admin');

      if (error) {
        if (error.message.includes('master admin')) {
          toast({
            title: "Access Denied",
            description: "Only the master admin can access user verification management.",
            variant: "destructive"
          });
          return;
        }
        throw error;
      }

      setProfiles(data || []);
    } catch (error: any) {
      console.error('Error loading profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load user profiles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterProfiles = () => {
    let filtered = [...profiles];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(profile =>
        profile.producer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.username?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter(profile => profile.role === filterRole);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(profile => profile.verification_status === filterStatus);
    }

    setFilteredProfiles(filtered);
  };

  const updateVerificationStatus = async (userId: string, newStatus: string) => {
    try {
      setUpdating(userId);

      const { data, error } = await supabase.rpc('update_user_verification', {
        user_id_param: userId,
        verification_status_param: newStatus
      });

      if (error) throw error;

      // Update local state
      setProfiles(profiles.map(profile =>
        profile.id === userId
          ? { ...profile, verification_status: newStatus }
          : profile
      ));

      toast({
        title: "Success",
        description: `User verification status updated to ${newStatus}`,
      });
    } catch (error: any) {
      console.error('Error updating verification:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update verification status",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const getDisplayName = (profile: UserProfile) => {
    if (profile.producer_name) return profile.producer_name;
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return profile.username || 'Unknown User';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            User Verification Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-pulse">Loading profiles...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          User Verification Management
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Manage verified badges for producers and artists
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="search">Search Users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="role-filter">Filter by Role</Label>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="producer">Producers</SelectItem>
                <SelectItem value="artist">Artists</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status-filter">Filter by Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{profiles.length}</div>
            <div className="text-sm text-muted-foreground">Total Users</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {profiles.filter(p => p.verification_status === 'verified').length}
            </div>
            <div className="text-sm text-muted-foreground">Verified</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">
              {profiles.filter(p => p.role === 'producer').length}
            </div>
            <div className="text-sm text-muted-foreground">Producers</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">
              {profiles.filter(p => p.role === 'artist').length}
            </div>
            <div className="text-sm text-muted-foreground">Artists</div>
          </div>
        </div>

        {/* User List */}
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Showing {filteredProfiles.length} of {profiles.length} users
          </div>
          
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users match your current filters
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProfiles.map((profile) => (
                <Card key={profile.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={profile.producer_logo_url} />
                        <AvatarFallback>
                          {profile.role === 'producer' ? (
                            <Headphones className="w-6 h-6" />
                          ) : (
                            <User className="w-6 h-6" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{getDisplayName(profile)}</span>
                          {profile.verification_status === 'verified' && (
                            <ShieldCheck className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {profile.role}
                          </Badge>
                          {profile.username && (
                            <span>@{profile.username}</span>
                          )}
                          <span>•</span>
                          <span>Joined {formatDate(profile.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={profile.verification_status === 'verified' ? 'default' : 'secondary'}
                        className={profile.verification_status === 'verified' ? 'bg-blue-500' : ''}
                      >
                        {profile.verification_status === 'verified' ? 'Verified' : 'Unverified'}
                      </Badge>
                      
                      <Select
                        value={profile.verification_status}
                        onValueChange={(value) => updateVerificationStatus(profile.id, value)}
                        disabled={updating === profile.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unverified">Unverified</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}