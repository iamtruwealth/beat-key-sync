import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Shield, ShieldCheck, ShieldX, User, Users } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_profiles_for_admin');
      
      if (error) {
        if (error.message.includes('master admin')) {
          toast({
            title: "Access Denied",
            description: "Only the master admin can access this feature.",
            variant: "destructive"
          });
          return;
        }
        throw error;
      }
      
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load user profiles.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateVerificationStatus = async (userId: string, status: string) => {
    setUpdating(userId);
    try {
      const { data, error } = await supabase.rpc('update_user_verification', {
        user_id_param: userId,
        verification_status_param: status
      });

      if (error) throw error;

      // Update local state
      setProfiles(profiles.map(profile => 
        profile.id === userId 
          ? { ...profile, verification_status: status }
          : profile
      ));

      toast({
        title: "Success",
        description: `User verification status updated to ${status}.`
      });
    } catch (error: any) {
      console.error('Error updating verification:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update verification status.",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30"><ShieldCheck className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Shield className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline"><ShieldX className="w-3 h-3 mr-1" />Unverified</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Verification Management</CardTitle>
          <CardDescription>Loading user profiles...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (profiles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Verification Management</CardTitle>
          <CardDescription>
            Access denied or no users found. Only the master admin can access this feature.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const verifiedCount = profiles.filter(p => p.verification_status === 'verified').length;
  const producerCount = profiles.filter(p => p.role === 'producer').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{profiles.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{verifiedCount}</p>
                <p className="text-sm text-muted-foreground">Verified Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{producerCount}</p>
                <p className="text-sm text-muted-foreground">Producers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Verification Management</CardTitle>
          <CardDescription>
            Manage verification status for all users. Only the master admin can perform these actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={profile.producer_logo_url} alt={profile.producer_name || profile.first_name} />
                        <AvatarFallback>
                          {(profile.producer_name || profile.first_name || 'U').charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {profile.producer_name || `${profile.first_name} ${profile.last_name}`.trim() || 'Unnamed User'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {profile.producer_name ? 'Producer' : 'User'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.role === 'producer' ? 'default' : 'secondary'}>
                      {profile.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {profile.username || 'No username'}
                    </code>
                  </TableCell>
                  <TableCell>
                    {getVerificationBadge(profile.verification_status)}
                  </TableCell>
                  <TableCell>
                    {new Date(profile.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {profile.verification_status !== 'verified' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateVerificationStatus(profile.id, 'verified')}
                          disabled={updating === profile.id}
                          className="text-blue-600 border-blue-600 hover:bg-blue-50"
                        >
                          <ShieldCheck className="w-4 h-4 mr-1" />
                          Verify
                        </Button>
                      )}
                      {profile.verification_status === 'verified' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateVerificationStatus(profile.id, 'unverified')}
                          disabled={updating === profile.id}
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <ShieldX className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}