import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Upload, User, MapPin, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  producer_name: string | null;
  home_town: string | null;
  producer_logo_url: string | null;
  genres: string[];
}

const GENRE_OPTIONS = [
  "Hip Hop", "Trap", "R&B", "Pop", "Rock", "Electronic", "Jazz", "Blues",
  "Country", "Reggae", "Afrobeat", "Latin", "House", "Techno", "Drill",
  "Boom Bap", "Lo-fi", "Ambient", "Funk", "Soul", "Gospel", "Alternative"
];

export default function Account() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    producer_name: "",
    home_town: "",
    genres: [] as string[]
  });
  const [newGenre, setNewGenre] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndFetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        navigate("/auth");
        return;
      }
      await fetchProfile();
    };
    
    checkAuthAndFetchProfile();
  }, [navigate]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile:", error);
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive"
        });
        return;
      }

      if (profile) {
        setProfile(profile);
        setFormData({
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
          producer_name: profile.producer_name || "",
          home_town: profile.home_town || "",
          genres: profile.genres || []
        });
      } else {
        // Create profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert([{ id: user.id }])
          .select()
          .single();

        if (createError) {
          console.error("Error creating profile:", createError);
        } else if (newProfile) {
          setProfile(newProfile);
          setFormData({
            first_name: "",
            last_name: "",
            producer_name: "",
            home_town: "",
            genres: []
          });
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `producer-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("artwork")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("artwork")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ producer_logo_url: data.publicUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, producer_logo_url: data.publicUrl } : null);
      toast({
        title: "Success",
        description: "Producer logo updated successfully"
      });
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const addGenre = () => {
    if (newGenre.trim() && formData.genres.length < 4 && !formData.genres.includes(newGenre.trim())) {
      setFormData(prev => ({
        ...prev,
        genres: [...prev.genres, newGenre.trim()]
      }));
      setNewGenre("");
    }
  };

  const removeGenre = (genreToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.filter(genre => genre !== genreToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          producer_name: formData.producer_name || null,
          home_town: formData.home_town || null,
          genres: formData.genres
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...formData } : null);
      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Account Settings</h1>
      </div>

      <div className="grid gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal information and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Enter your first name"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Enter your last name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="producer_name" className="flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  Producer Name
                </Label>
                <Input
                  id="producer_name"
                  value={formData.producer_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, producer_name: e.target.value }))}
                  placeholder="Enter your producer name (e.g., DJ Producer, BeatMaker)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will be automatically added to your uploaded tracks as the artist name
                </p>
              </div>

              <div>
                <Label htmlFor="home_town" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Home Town
                </Label>
                <Input
                  id="home_town"
                  value={formData.home_town}
                  onChange={(e) => setFormData(prev => ({ ...prev, home_town: e.target.value }))}
                  placeholder="Enter your home town"
                />
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Producer Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Producer Logo
            </CardTitle>
            <CardDescription>
              Upload your producer logo to personalize your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {profile?.producer_logo_url && (
                <div className="flex items-center gap-4">
                  <img
                    src={profile.producer_logo_url}
                    alt="Producer logo"
                    className="w-24 h-24 rounded-lg object-cover border"
                  />
                  <div>
                    <p className="text-sm font-medium">Current Logo</p>
                    <p className="text-xs text-muted-foreground">Upload a new image to replace</p>
                  </div>
                </div>
              )}
              
              <div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: Square image, at least 200x200px
                </p>
              </div>
              
              {uploading && (
                <p className="text-sm text-primary">Uploading logo...</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Genres */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5" />
              Music Genres
            </CardTitle>
            <CardDescription>
              Select up to 4 genres that best represent your music style
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Current Genres */}
              {formData.genres.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Selected Genres ({formData.genres.length}/4)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.genres.map((genre) => (
                      <Badge key={genre} variant="secondary" className="flex items-center gap-1">
                        {genre}
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-destructive"
                          onClick={() => removeGenre(genre)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Genre */}
              {formData.genres.length < 4 && (
                <div>
                  <Label htmlFor="genre-input">Add Genre</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="genre-input"
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value)}
                      placeholder="Type a genre or select from suggestions"
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addGenre();
                        }
                      }}
                    />
                    <Button type="button" onClick={addGenre} disabled={!newGenre.trim()}>
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {/* Genre Suggestions */}
              {formData.genres.length < 4 && (
                <div>
                  <Label className="text-sm font-medium">Popular Genres</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {GENRE_OPTIONS
                      .filter(genre => !formData.genres.includes(genre))
                      .slice(0, 8)
                      .map((genre) => (
                        <Badge
                          key={genre}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                          onClick={() => {
                            if (formData.genres.length < 4) {
                              setFormData(prev => ({
                                ...prev,
                                genres: [...prev.genres, genre]
                              }));
                            }
                          }}
                        >
                          {genre}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}