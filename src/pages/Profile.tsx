import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Camera, 
  MapPin, 
  Calendar, 
  Music, 
  Award,
  ExternalLink,
  Instagram,
  Youtube,
  Globe,
  Save,
  Upload,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  first_name?: string;
  last_name?: string;
  artist_name?: string;
  producer_name?: string;
  username?: string;
  bio?: string;
  home_town?: string;
  genres?: string[];
  role: 'artist' | 'producer';
  producer_logo_url?: string;
  social_links?: Record<string, string>;
  verification_status: string;
  public_profile_enabled: boolean;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [newGenre, setNewGenre] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        // Redirect to auth page or show login required message
        return;
      }
      await loadProfile();
    };
    
    checkAuthAndLoadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please choose an image under 5MB",
          variant: "destructive"
        });
        return;
      }
      setLogoFile(file);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      let logoUrl = profile.producer_logo_url;

      // Upload new logo if selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${profile.id}/${profile.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('artwork')
          .upload(fileName, logoFile);
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('artwork')
          .getPublicUrl(fileName);
        logoUrl = publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          ...profile,
          producer_logo_url: logoUrl
        })
        .eq('id', profile.id);

      if (error) throw error;

      setIsEditing(false);
      setLogoFile(null);
      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (updates: Partial<Profile>) => {
    if (profile) {
      setProfile({ ...profile, ...updates });
    }
  };

  const updateSocialLinks = (platform: string, url: string) => {
    const socialLinks = { ...profile?.social_links, [platform]: url };
    updateProfile({ social_links: socialLinks });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p>Profile not found</p>
      </div>
    );
  }

  const displayName = profile.role === 'artist'
    ? profile.artist_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : profile.producer_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">Manage your public and private profile information</p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={saveProfile} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="public">Public Page</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your personal and professional details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={profile.producer_logo_url} />
                  <AvatarFallback className="text-lg">
                    {displayName ? displayName[0].toUpperCase() : <User className="w-8 h-8" />}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Change Photo
                    </Button>
                    {logoFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selected: {logoFile.name}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    value={profile.first_name || ''}
                    onChange={(e) => updateProfile({ first_name: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    value={profile.last_name || ''}
                    onChange={(e) => updateProfile({ last_name: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={profile.username || ''}
                    onChange={(e) => updateProfile({ username: e.target.value })}
                    disabled={!isEditing}
                    placeholder="e.g., keilowbeats"
                  />
                </div>
                {profile.role === 'artist' && (
                  <div>
                    <Label htmlFor="artist-name">Artist Name</Label>
                    <Input
                      id="artist-name"
                      value={profile.artist_name || ''}
                      onChange={(e) => updateProfile({ artist_name: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Your stage/artist name"
                    />
                  </div>
                )}
                {profile.role === 'producer' && (
                  <div>
                    <Label htmlFor="producer-name">Producer Name</Label>
                    <Input
                      id="producer-name"
                      value={profile.producer_name || ''}
                      onChange={(e) => updateProfile({ producer_name: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                )}
              </div>

              {/* Bio */}
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profile.bio || ''}
                  onChange={(e) => updateProfile({ bio: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Tell people about yourself and your music..."
                  rows={4}
                />
              </div>

              {/* Location */}
              <div>
                <Label htmlFor="hometown">Hometown</Label>
                <Input
                  id="hometown"
                  value={profile.home_town || ''}
                  onChange={(e) => updateProfile({ home_town: e.target.value })}
                  disabled={!isEditing}
                  placeholder="e.g., Los Angeles, CA"
                />
              </div>

              {/* Genres */}
              <div>
                <Label>Genres</Label>
                <div className="space-y-3 mt-2">
                  <div className="flex flex-wrap gap-2">
                    {profile.genres?.map((genre, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {genre}
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              const updatedGenres = profile.genres?.filter((_, i) => i !== index) || [];
                              updateProfile({ genres: updatedGenres });
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                  {isEditing && profile.genres && profile.genres.length < 4 && (
                    <div className="flex gap-2">
                      <Input
                        value={newGenre}
                        onChange={(e) => setNewGenre(e.target.value)}
                        placeholder="Add a genre"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newGenre.trim() && !profile.genres?.includes(newGenre.trim())) {
                              const updatedGenres = [...(profile.genres || []), newGenre.trim()];
                              updateProfile({ genres: updatedGenres });
                              setNewGenre("");
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (newGenre.trim() && !profile.genres?.includes(newGenre.trim())) {
                            const updatedGenres = [...(profile.genres || []), newGenre.trim()];
                            updateProfile({ genres: updatedGenres });
                            setNewGenre("");
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                  {profile.genres && profile.genres.length >= 4 && isEditing && (
                    <p className="text-xs text-muted-foreground">Maximum 4 genres reached</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle>Social Links</CardTitle>
              <CardDescription>Connect your social media accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="instagram">Instagram</Label>
                  <div className="flex">
                    <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                      <Instagram className="w-4 h-4" />
                    </div>
                    <Input
                      id="instagram"
                      value={profile.social_links?.instagram || ''}
                      onChange={(e) => updateSocialLinks('instagram', e.target.value)}
                      disabled={!isEditing}
                      placeholder="@username"
                      className="rounded-l-none"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="twitter">X (Twitter)</Label>
                  <div className="flex">
                    <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                      <X className="w-4 h-4" />
                    </div>
                    <Input
                      id="twitter"
                      value={profile.social_links?.twitter || ''}
                      onChange={(e) => updateSocialLinks('twitter', e.target.value)}
                      disabled={!isEditing}
                      placeholder="@username"
                      className="rounded-l-none"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="youtube">YouTube</Label>
                  <div className="flex">
                    <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                      <Youtube className="w-4 h-4" />
                    </div>
                    <Input
                      id="youtube"
                      value={profile.social_links?.youtube || ''}
                      onChange={(e) => updateSocialLinks('youtube', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Channel URL"
                      className="rounded-l-none"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <div className="flex">
                    <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                      <Globe className="w-4 h-4" />
                    </div>
                    <Input
                      id="website"
                      value={profile.social_links?.website || ''}
                      onChange={(e) => updateSocialLinks('website', e.target.value)}
                      disabled={!isEditing}
                      placeholder="https://your-website.com"
                      className="rounded-l-none"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="public" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Public Profile</CardTitle>
              <CardDescription>How others see your profile on BeatPackz</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Public Profile Preview</h3>
                <p className="text-muted-foreground mb-4">
                  Your public profile will show your bio, genres, and recent work
                </p>
                <Button variant="outline" asChild>
                  <a href={`https://beatpackz.store/${profile.username || profile.id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Public Profile
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Privacy and account preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Banner Upload Section */}
              <div>
                <Label htmlFor="banner">Banner Image</Label>
                <div className="mt-2">
                  <Input
                    type="file"
                    accept="image/*"
                    id="banner-upload"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('banner-upload')?.click()}
                    disabled={!isEditing}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Banner
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Recommended size: 1920x480px. This will be displayed on your public profile.
                  </p>
                </div>
              </div>
              
              <Separator />
              
              {/* Privacy Settings */}
              <div>
                <h4 className="font-medium mb-3">Privacy Settings</h4>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={profile.public_profile_enabled}
                      onChange={(e) => updateProfile({ public_profile_enabled: e.target.checked })}
                      disabled={!isEditing}
                      className="rounded"
                    />
                    <span className="text-sm">Enable public profile</span>
                  </label>
                  <p className="text-xs text-muted-foreground ml-6">
                    Allow others to discover and view your profile
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}