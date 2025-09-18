import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Users, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Producer {
  id: string;
  name: string;
  avatar: string;
  location: string;
  followers: number;
  tracksCount: number;
  genres: string[];
  previewTrack: {
    title: string;
    duration: string;
    bpm: number;
    key: string;
  };
}

const mockProducers: Producer[] = [
  {
    id: "1",
    name: "Alex Meridian",
    avatar: "",
    location: "Los Angeles, CA",
    followers: 12500,
    tracksCount: 48,
    genres: ["House", "Tech House", "Deep House"],
    previewTrack: {
      title: "Midnight Groove",
      duration: "3:42",
      bpm: 128,
      key: "Am"
    }
  },
  {
    id: "2",
    name: "Luna Beats",
    avatar: "",
    location: "Berlin, Germany",
    followers: 8900,
    tracksCount: 32,
    genres: ["Ambient", "Downtempo", "Chill"],
    previewTrack: {
      title: "Ethereal Dreams",
      duration: "4:15",
      bpm: 85,
      key: "C#m"
    }
  },
  {
    id: "3",
    name: "Bass Prophet",
    avatar: "",
    location: "London, UK",
    followers: 15200,
    tracksCount: 67,
    genres: ["Drum & Bass", "Dubstep", "Future Bass"],
    previewTrack: {
      title: "Digital Storm",
      duration: "3:28",
      bpm: 174,
      key: "Fm"
    }
  },
  {
    id: "4",
    name: "Synthwave King",
    avatar: "",
    location: "Miami, FL",
    followers: 6780,
    tracksCount: 25,
    genres: ["Synthwave", "Retrowave", "Cyberpunk"],
    previewTrack: {
      title: "Neon Highway",
      duration: "4:01",
      bpm: 110,
      key: "Em"
    }
  },
  {
    id: "5",
    name: "Jazz Fusion Pro",
    avatar: "",
    location: "New York, NY",
    followers: 9340,
    tracksCount: 41,
    genres: ["Jazz Fusion", "Neo-Soul", "Hip Hop"],
    previewTrack: {
      title: "Urban Sophistication",
      duration: "3:55",
      bpm: 95,
      key: "Bb"
    }
  },
  {
    id: "6",
    name: "Trap Master",
    avatar: "",
    location: "Atlanta, GA",
    followers: 18700,
    tracksCount: 89,
    genres: ["Trap", "Hip Hop", "Future Trap"],
    previewTrack: {
      title: "808 Dreams",
      duration: "2:47",
      bpm: 145,
      key: "Gm"
    }
  }
];

export default function Explore() {
  const navigate = useNavigate();

  const handleProducerClick = (producerId: string, producerName: string) => {
    // For now, navigate to library with producer info in state
    navigate('/library', { 
      state: { 
        producerId, 
        producerName,
        isExternalProducer: true 
      } 
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Explore Producers
        </h1>
        <p className="text-muted-foreground">
          Discover talented producers and their latest tracks
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockProducers.map((producer) => (
          <Card key={producer.id} className="overflow-hidden bg-card/50 border-border/50 hover:bg-card/70 transition-colors">
            <CardContent className="p-6 space-y-4">
              {/* Producer Header */}
              <div className="flex items-start gap-4">
                <button
                  onClick={() => handleProducerClick(producer.id, producer.name)}
                  className="transition-transform hover:scale-105"
                >
                  <Avatar className="w-16 h-16 border-2 border-primary/20">
                    <AvatarImage src={producer.avatar} alt={producer.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                      {producer.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                </button>
                
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => handleProducerClick(producer.id, producer.name)}
                    className="text-left hover:text-primary transition-colors"
                  >
                    <h3 className="font-semibold text-foreground truncate">
                      {producer.name}
                    </h3>
                  </button>
                  <p className="text-sm text-muted-foreground">
                    {producer.location}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {producer.followers.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      {producer.tracksCount} tracks
                    </div>
                  </div>
                </div>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-1">
                {producer.genres.slice(0, 3).map((genre) => (
                  <span 
                    key={genre}
                    className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              {/* Preview Track */}
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div>
                  <h4 className="font-medium text-sm text-foreground">
                    Latest Track
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {producer.previewTrack.title}
                  </p>
                </div>

                {/* Track Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span>{producer.previewTrack.duration}</span>
                    <span>{producer.previewTrack.bpm} BPM</span>
                    <span>{producer.previewTrack.key}</span>
                  </div>
                </div>

                {/* Waveform Placeholder */}
                <div className="h-12 bg-muted/30 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 opacity-60"></div>
                  <div className="relative flex items-center gap-1">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-primary/60 rounded-full"
                        style={{
                          height: `${Math.random() * 20 + 10}px`
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Play Button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full bg-background/50 border-primary/30 hover:bg-primary/10"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Preview Track
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}