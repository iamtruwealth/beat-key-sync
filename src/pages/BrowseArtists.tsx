import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Music, ArrowLeft, MapPin, Instagram, Youtube, Music2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import verifiedBadge from "@/assets/verified-badge.png";
import { FaTwitter, FaSoundcloud, FaSpotify, FaTiktok } from "react-icons/fa";

interface Artist {
  id: string;
  username: string;
  producer_name: string;
  producer_logo_url: string;
  verification_status: string;
  genres: string[];
  bio: string;
  hometown: string;
  social_links: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
    spotify?: string;
    soundcloud?: string;
    tiktok?: string;
  };
}

export default function BrowseArtists() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredArtists, setFilteredArtists] = useState<Artist[]>([]);

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
          return (
            artist.producer_name?.toLowerCase().includes(query) ||
            artist.username?.toLowerCase().includes(query) ||
            artist.genres?.some(g => g.toLowerCase().includes(query))
          );
        })
      );
    }
  }, [searchQuery, artists]);

  const loadArtists = async () => {
    try {
      const { data, error } = await supabase
        .rpc("get_public_artist_profiles");

      if (error) throw error;

      setArtists(data || []);
      setFilteredArtists(data || []);
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
            Discover talented artists and producers
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
                : "No artists have enabled their public profiles yet"}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArtists.map((artist) => (
              <Card
                key={artist.id}
                className="group hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden"
                onClick={() => navigate(`/${artist.username}`)}
              >
                <CardContent className="p-0">
                  <div className="relative h-48 bg-gradient-to-br from-primary/20 to-accent/20 overflow-hidden">
                    {artist.producer_logo_url ? (
                      <img
                        src={artist.producer_logo_url}
                        alt={artist.producer_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="h-16 w-16 text-primary/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {artist.verification_status === "verified" && (
                      <img 
                        src={verifiedBadge} 
                        alt="Verified" 
                        className="absolute top-3 right-3 h-8 w-8"
                      />
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors">
                      {artist.producer_name}
                    </h3>

                    {artist.hometown && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                        <MapPin className="h-3 w-3" />
                        <span>{artist.hometown}</span>
                      </div>
                    )}

                    {artist.genres && artist.genres.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {artist.genres.slice(0, 3).map((genre, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {genre}
                          </Badge>
                        ))}
                        {artist.genres.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{artist.genres.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {artist.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {artist.bio}
                      </p>
                    )}

                    {artist.social_links && Object.keys(artist.social_links).length > 0 && (
                      <div className="flex items-center gap-3 mb-4">
                        {artist.social_links.instagram && (
                          <a
                            href={artist.social_links.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Instagram className="h-4 w-4" />
                          </a>
                        )}
                        {artist.social_links.twitter && (
                          <a
                            href={artist.social_links.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <FaTwitter className="h-4 w-4" />
                          </a>
                        )}
                        {artist.social_links.spotify && (
                          <a
                            href={artist.social_links.spotify}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <FaSpotify className="h-4 w-4" />
                          </a>
                        )}
                        {artist.social_links.soundcloud && (
                          <a
                            href={artist.social_links.soundcloud}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <FaSoundcloud className="h-4 w-4" />
                          </a>
                        )}
                        {artist.social_links.youtube && (
                          <a
                            href={artist.social_links.youtube}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Youtube className="h-4 w-4" />
                          </a>
                        )}
                        {artist.social_links.tiktok && (
                          <a
                            href={artist.social_links.tiktok}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <FaTiktok className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/${artist.username}`);
                      }}
                    >
                      View Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
