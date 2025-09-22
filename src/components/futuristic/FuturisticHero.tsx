import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function FuturisticHero() {
  const navigate = useNavigate();
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const fullText = "The Future of Beat Production";

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          className="w-full h-full object-cover opacity-60"
          autoPlay
          muted
          loop
          playsInline
          onLoadedData={() => setIsVideoLoaded(true)}
        >
          <source src="/assets/hero-video.mp4" type="video/mp4" />
        </video>
        {/* Video overlay gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" />
      </div>

      {/* Abstract floating elements */}
      <div className="absolute inset-0 z-10">
        <div className="absolute top-20 left-10 w-32 h-32 bg-neon-cyan/20 rounded-full blur-xl animate-float" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-neon-magenta/20 rounded-full blur-lg animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-40 left-1/4 w-20 h-20 bg-electric-blue/20 rounded-full blur-md animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-neon-purple/20 rounded-full blur-lg animate-float" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Main content */}
      <div className="relative z-20 text-center max-w-6xl mx-auto px-6">
        {/* Brand/Logo */}
        <div className="mb-8 animate-slide-up">
          <h1 className="text-6xl md:text-8xl font-black tracking-wider mb-4">
            <span className="gradient-text">BEAT</span>
            <span className="text-neon-cyan">PACKZ</span>
          </h1>
        </div>

        {/* Typing effect headline */}
        <div className="mb-12 animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground min-h-[1.2em]">
            <span className="typing-effect text-electric-blue">
              {displayText}
            </span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: '1s' }}>
            Discover premium beats, connect with top producers, and elevate your music with our cutting-edge platform
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16 animate-slide-up" style={{ animationDelay: '1.5s' }}>
          <Button 
            size="lg" 
            className="px-8 py-4 text-lg font-semibold bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue-glow neon-glow-hover ripple transform hover:scale-105 transition-all duration-300"
            onClick={() => navigate("/explore")}
          >
            <Play className="w-5 h-5 mr-2" />
            Explore Beats
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            className="px-8 py-4 text-lg font-semibold border-2 border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-background hover:shadow-lg hover:shadow-neon-magenta/30 transition-all duration-300"
            onClick={() => navigate("/auth")}
          >
            Start Creating
          </Button>
        </div>

        {/* Stats preview */}
        <div className="glass-morphism rounded-2xl p-6 max-w-4xl mx-auto animate-scale-in" style={{ animationDelay: '2s' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCounter end={10000} label="Beats" suffix="+" />
            <StatCounter end={500} label="Producers" suffix="+" />
            <StatCounter end={50000} label="Downloads" suffix="+" />
            <StatCounter end={1000} label="New Tracks" suffix="/week" />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8 text-neon-cyan animate-glow-pulse" />
        </div>
      </div>
    </section>
  );
}

function StatCounter({ end, label, suffix = "" }: { end: number; label: string; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const increment = end / 100;
    const timer = setInterval(() => {
      setCount(prev => {
        if (prev < end) {
          return Math.min(prev + increment, end);
        }
        clearInterval(timer);
        return end;
      });
    }, 20);

    return () => clearInterval(timer);
  }, [end]);

  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl font-bold text-neon-cyan">
        {Math.floor(count).toLocaleString()}{suffix}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}