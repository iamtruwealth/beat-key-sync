import { useState, useRef } from "react";
import { GlassMorphismSection } from "./GlassMorphismSection";
import { ScrollAnimationWrapper } from "./ScrollAnimationWrapper";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

export function PromoVideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const loadVideo = () => {
    if (!isLoaded) {
      setIsLoaded(true);
    }
  };

  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-6">
        <ScrollAnimationWrapper>
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="gradient-text">Experience</span>{" "}
              <span className="text-electric-blue">BeatPackz</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See what makes our platform the future of beat production
            </p>
          </div>
        </ScrollAnimationWrapper>

        <ScrollAnimationWrapper animation="scale-in" delay={200}>
          <GlassMorphismSection variant="neon" className="max-w-4xl mx-auto">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-card/20">
              {!isLoaded ? (
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-card/20 cursor-pointer group"
                  onClick={loadVideo}
                >
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-neon-cyan/20 rounded-full flex items-center justify-center group-hover:bg-neon-cyan/30 transition-colors duration-300">
                      <Play className="w-8 h-8 text-neon-cyan ml-1" />
                    </div>
                    <p className="text-muted-foreground">Click to load promo video</p>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted={isMuted}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    preload="metadata"
                  >
                    <source src="/assets/beatpackz-promo-2.mp4" type="video/mp4" />
                  </video>
                  
                  {/* Video Controls Overlay */}
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors duration-300 group">
                    <div className="absolute bottom-4 left-4 right-4 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={togglePlay}
                        className="bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </Button>
                      
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={toggleMute}
                        className="bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </Button>
                      
                      <div className="flex-1" />
                      
                      <div className="text-sm text-muted-foreground bg-background/80 px-3 py-1 rounded backdrop-blur-sm">
                        BeatPackz Promo
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </GlassMorphismSection>
        </ScrollAnimationWrapper>
      </div>
    </section>
  );
}