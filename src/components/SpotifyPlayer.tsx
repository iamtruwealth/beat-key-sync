import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Volume2,
  Heart,
  MoreHorizontal,
  Download,
  Link,
  Copy
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Track {
  id: string;
  title: string;
  artist: string;
  producer_name?: string;
  duration: number;
  file_url: string;
  detected_key?: string;
  detected_bpm?: number;
  manual_key?: string;
  manual_bpm?: number;
}

interface BeatPack {
  id: string;
  name: string;
  description?: string;
  artwork_url?: string;
  tracks: Track[];
  download_enabled?: boolean;
}

interface SpotifyPlayerProps {
  beatPack: BeatPack;
}

export function SpotifyPlayer({ beatPack }: SpotifyPlayerProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'none' | 'one' | 'all'>('none');
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const currentTrack = beatPack.tracks[currentTrackIndex];
  const progressPercent = currentTrack ? (currentTime / currentTrack.duration) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => handleNext();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrackIndex]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getKey = (track: Track) => track.manual_key || track.detected_key || 'Unknown';
  const getBPM = (track: Track) => track.manual_bpm || track.detected_bpm || 0;

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handlePrevious = () => {
    setCurrentTrackIndex(prev => 
      prev > 0 ? prev - 1 : beatPack.tracks.length - 1
    );
    setCurrentTime(0);
  };

  const handleNext = () => {
    if (repeat === 'one') {
      setCurrentTime(0);
      audioRef.current?.play();
      return;
    }

    if (shuffle) {
      const randomIndex = Math.floor(Math.random() * beatPack.tracks.length);
      setCurrentTrackIndex(randomIndex);
    } else {
      setCurrentTrackIndex(prev => {
        const nextIndex = prev + 1;
        if (nextIndex >= beatPack.tracks.length) {
          return repeat === 'all' ? 0 : prev;
        }
        return nextIndex;
      });
    }
    setCurrentTime(0);
  };

  const handleTrackSelect = (index: number) => {
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * currentTrack.duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const copyPackLink = () => {
    const url = `${window.location.origin}/pack/${beatPack.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Beat pack link copied to clipboard"
    });
  };

  const downloadTrack = async (track: Track) => {
    try {
      const response = await fetch(track.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: `Downloading ${track.title}`
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download track",
        variant: "destructive"
      });
    }
  };

  const downloadAllTracks = async () => {
    for (const track of beatPack.tracks) {
      await downloadTrack(track);
      // Add small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  if (!currentTrack) return null;

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={currentTrack.file_url}
      />

      {/* Header with beat pack info */}
      <div className="bg-gradient-to-b from-[#1e3a8a] to-[#121212] p-8">
        <div className="flex items-end gap-6 max-w-6xl mx-auto">
          <div className="w-60 h-60 bg-[#282828] rounded-lg shadow-2xl overflow-hidden">
            {beatPack.artwork_url ? (
              <img 
                src={beatPack.artwork_url} 
                alt={beatPack.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                <div className="text-4xl font-bold text-primary/60">BP</div>
              </div>
            )}
          </div>
          <div className="flex-1 pb-6">
            <p className="text-sm font-medium uppercase tracking-wider mb-2">Beat Pack</p>
            <h1 className="text-6xl font-black mb-4">{beatPack.name}</h1>
            {beatPack.description && (
              <p className="text-[#b3b3b3] text-lg mb-4">{beatPack.description}</p>
            )}
            <div className="flex items-center gap-4 mb-4">
              <p className="text-[#b3b3b3] text-sm">
                {beatPack.tracks.length} track{beatPack.tracks.length !== 1 ? 's' : ''}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={copyPackLink}
                className="text-white border-white/20 hover:bg-white/10"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              {beatPack.download_enabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadAllTracks}
                  className="text-white border-white/20 hover:bg-white/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="sticky top-0 bg-[#121212]/95 backdrop-blur-sm border-b border-[#282828] p-4 z-10">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-[#b3b3b3] hover:text-white h-8 w-8"
              onClick={handlePrevious}
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="bg-white text-black hover:bg-white/90 h-10 w-10 rounded-full"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="text-[#b3b3b3] hover:text-white h-8 w-8"
              onClick={handleNext}
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${shuffle ? 'text-[#1db954]' : 'text-[#b3b3b3] hover:text-white'}`}
              onClick={() => setShuffle(!shuffle)}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${repeat !== 'none' ? 'text-[#1db954]' : 'text-[#b3b3b3] hover:text-white'}`}
              onClick={() => setRepeat(prev => 
                prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none'
              )}
            >
              <Repeat className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mt-4 max-w-6xl mx-auto">
          <span className="text-xs text-[#b3b3b3] w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <div 
            className="flex-1 h-1 bg-[#535353] rounded-full cursor-pointer group"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-white rounded-full relative group-hover:bg-[#1db954]"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100" />
            </div>
          </div>
          <span className="text-xs text-[#b3b3b3] w-10">
            {formatTime(currentTrack.duration)}
          </span>
        </div>
      </div>

      {/* Track list */}
      <div className="max-w-6xl mx-auto p-8">
        <div className="grid grid-cols-12 gap-4 text-[#b3b3b3] text-sm font-medium border-b border-[#282828] pb-2 mb-4">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Key</div>
          <div className="col-span-2">BPM</div>
          <div className="col-span-1">Duration</div>
          {beatPack.download_enabled && <div className="col-span-1"></div>}
        </div>

        <div className="space-y-1">
          {beatPack.tracks.map((track, index) => (
            <div
              key={track.id}
              className={`grid grid-cols-12 gap-4 items-center p-2 rounded group hover:bg-[#1a1a1a] cursor-pointer ${
                index === currentTrackIndex ? 'bg-[#1a1a1a]' : ''
              }`}
              onClick={() => handleTrackSelect(index)}
            >
              <div className="col-span-1 text-[#b3b3b3] text-sm">
                {index === currentTrackIndex && isPlaying ? (
                  <div className="w-4 h-4 flex items-center justify-center">
                    <div className="flex gap-0.5">
                      <div className="w-0.5 h-3 bg-[#1db954] animate-pulse" />
                      <div className="w-0.5 h-2 bg-[#1db954] animate-pulse" style={{ animationDelay: '0.1s' }} />
                      <div className="w-0.5 h-4 bg-[#1db954] animate-pulse" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                ) : (
                  <span className="group-hover:hidden">{index + 1}</span>
                )}
                <Play className="w-4 h-4 hidden group-hover:block" />
              </div>
              
              <div className={`${beatPack.download_enabled ? 'col-span-5' : 'col-span-6'}`}>
                <div className={`font-medium ${index === currentTrackIndex ? 'text-[#1db954]' : 'text-white'}`}>
                  {track.title}
                </div>
                <div className="text-sm text-[#b3b3b3]">{track.producer_name || track.artist}</div>
              </div>
              
              <div className="col-span-2 text-[#b3b3b3] text-sm">
                {getKey(track)}
              </div>
              
              <div className="col-span-2 text-[#b3b3b3] text-sm">
                {getBPM(track)} BPM
              </div>
              
              <div className="col-span-1 text-[#b3b3b3] text-sm text-right">
                {formatTime(track.duration)}
              </div>

              {beatPack.download_enabled && (
                <div className="col-span-1 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadTrack(track);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#b3b3b3] hover:text-white h-6 w-6"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}