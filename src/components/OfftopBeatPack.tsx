import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  file_url: string;
  detected_key?: string;
  detected_bpm?: number;
  manual_key?: string;
  manual_bpm?: number;
  tags?: string[];
}

interface BeatPack {
  id: string;
  name: string;
  description?: string;
  artwork_url?: string;
  tracks: Track[];
  download_enabled?: boolean;
}

interface OfftopBeatPackProps {
  beatPack: BeatPack;
}

interface CompactPlayerProps {
  track: Track;
  isActive: boolean;
  onTogglePlay: () => void;
}

function CompactPlayer({ track, isActive, onTogglePlay }: CompactPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (!isActive && isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
    }
  }, [isActive]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      onTogglePlay();
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !track.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * track.duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = track.duration ? (currentTime / track.duration) * 100 : 0;

  return (
    <div className="w-full h-10 bg-gray-50 rounded-md flex items-center px-3 gap-2">
      <audio ref={audioRef} src={track.file_url} />
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 p-0 hover:bg-gray-200"
        onClick={handlePlayPause}
      >
        {isPlaying && isActive ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3" />
        )}
      </Button>

      <div className="flex-1 flex items-center gap-2">
        <div 
          className="flex-1 h-1 bg-gray-200 rounded-full cursor-pointer"
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-gray-800 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        <span className="text-xs text-gray-600 min-w-[35px]">
          {formatTime(currentTime)}
        </span>
      </div>
    </div>
  );
}

export function OfftopBeatPack({ beatPack }: OfftopBeatPackProps) {
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const { toast } = useToast();

  const getKey = (track: Track) => track.manual_key || track.detected_key || 'Unknown';
  const getBPM = (track: Track) => track.manual_bpm || track.detected_bpm || 0;

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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const handleTrackToggle = (trackId: string) => {
    setActiveTrackId(prev => prev === trackId ? null : trackId);
  };

  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                {beatPack.name}
              </h1>
              {beatPack.description && (
                <p className="text-base text-gray-600 mb-4">
                  {beatPack.description}
                </p>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyPackLink}
                className="h-8 px-3 text-sm font-medium rounded-md border-gray-300 hover:bg-gray-50"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              
              {beatPack.download_enabled && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={downloadAllTracks}
                  className="h-10 px-4 text-sm font-medium rounded-md bg-gray-900 hover:bg-gray-800"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Beat List Section */}
        <div className="space-y-3">
          {beatPack.tracks.map((track) => (
            <div
              key={track.id}
              className="min-h-[80px] md:h-20 w-full border border-gray-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between bg-white hover:bg-gray-50 transition-colors gap-3 md:gap-0"
            >
              {/* Left - File info (25%) */}
              <div className="w-full md:flex-[0_0_25%] md:pr-4">
                <h3 className="text-base font-medium text-gray-900 truncate">
                  {track.title}
                </h3>
                <div className="text-sm text-gray-500 mt-1">
                  {getBPM(track)} BPM • {getKey(track)} • {track.tags?.[0] || 'Instrumental'}
                </div>
              </div>

              {/* Middle - Audio Player (50%) */}
              <div className="w-full md:flex-[0_0_50%] md:px-4">
                <CompactPlayer
                  track={track}
                  isActive={activeTrackId === track.id}
                  onTogglePlay={() => handleTrackToggle(track.id)}
                />
              </div>

              {/* Right - Download/Streaming (25%) */}
              <div className="w-full md:flex-[0_0_25%] flex justify-start md:justify-end md:pl-4">
                {beatPack.download_enabled ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => downloadTrack(track)}
                    className="h-9 px-4 text-sm font-medium rounded-md bg-gray-900 hover:bg-gray-800"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                ) : (
                  <span className="text-sm text-gray-500 font-medium">
                    Streaming only
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Beat list is responsive via Tailwind classes */}
      </div>
    </div>
  );
}