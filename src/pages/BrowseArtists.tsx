import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Music, CheckCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ArtistEPK {
  slug: string;
  artist_id: string;
  theme_settings: any;
  profiles: {
    producer_name: string;
    producer_logo_url: string;
    verification_status: string;
    genres: string[];
    bio: string;
  } | null;
}

export default function BrowseArtists() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [artists, setArtists] = useState<ArtistEPK[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredArtists, setFilteredArtists] = useState<ArtistEPK[]>([]);

  useEffect(() => {
    loadArtists();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredArtists(artists);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredArtists(
        artists.filter((artist) => {
          if (!artist.profiles) return false;
          return (
            artist.profiles.producer_name?.toLowerCase().includes(query) ||
            artist.profiles.genres?.some(g => g.toLowerCase().includes(query))
          );
        })
      );
    }
  }, [searchQuery, artists]);

  const loadArtists = async () => {
    try {
      const { data, error } = await supabase
        .from("artist_epk_profiles")
        .select(`
          slug,
          artist_id,
          theme_settings,
          profiles!artist_epk_profiles_artist_id_fkey (
            producer_name,
            producer_logo_url,
            verification_status,
            genres,
            bio
          )
        `)
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform data: profiles comes back as an array, take the first element
      const transformedData = data?.map((epk: any) => ({
        ...epk,
        profiles: Array.isArray(epk.profiles) ? epk.profiles[0] : epk.profiles
      })) || [];

      // Filter out artists without profile data
      const validArtists = transformedData.filter(
        (epk: ArtistEPK) => epk.profiles && epk.profiles.producer_name
      );

      setArtists(validArtists);
      setFilteredArtists(validArtists);
    } catch (error: any) {
      console.error("Error loading artists:", error);
      toast({
        title: "Error",
        description: "Failed to load artists",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Browse Artists
          </h1>
          <p className="text-muted-foreground">
            Discover talented artists and explore their electronic press kits
          </p>
        </div>

        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search artists or genres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredArtists.length === 0 ? (
          <Card className="p-12 text-center">
            <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">No Artists Found</h2>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search"
                : "No artists have published their EPKs yet"}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArtists.map((artist) => {
              if (!artist.profiles) return null;
              return (
                <Card
                  key={artist.slug}
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/epk/${artist.slug}`)}
                >
                  <CardContent className="p-0">
                    <div className="relative h-48 bg-gradient-to-br from-primary/20 to-accent/20 overflow-hidden">
                      {artist.profiles.producer_logo_url ? (
                        <img
                          src={artist.profiles.producer_logo_url}
                          alt={artist.profiles.producer_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="h-16 w-16 text-primary/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      {artist.profiles.verification_status === "verified" && (
                        <Badge className="absolute top-3 right-3 bg-primary/90 backdrop-blur-sm">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>

                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                        {artist.profiles.producer_name}
                      </h3>

                      {artist.profiles.genres && artist.profiles.genres.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {artist.profiles.genres.slice(0, 3).map((genre, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {genre}
                            </Badge>
                          ))}
                          {artist.profiles.genres.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{artist.profiles.genres.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      {artist.profiles.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {artist.profiles.bio}
                        </p>
                      )}

                      <Button
                        variant="outline"
                        className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/epk/${artist.slug}`);
                        }}
                      >
                        View EPK
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
