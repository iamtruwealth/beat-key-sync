import { ReactNode } from "react";

interface GlassMorphismSectionProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "gradient" | "neon";
}

export function GlassMorphismSection({ 
  children, 
  className = "", 
  variant = "default" 
}: GlassMorphismSectionProps) {
  const baseClasses = "glass-morphism rounded-2xl p-8 relative overflow-hidden";
  
  const variantClasses = {
    default: "border-border",
    gradient: "border-neon-cyan/30 bg-gradient-to-br from-background/10 to-card/20",
    neon: "border-electric-blue/40 shadow-lg shadow-electric-blue/20"
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute w-32 h-32 bg-neon-cyan rounded-full blur-3xl -top-16 -left-16 animate-float" />
        <div className="absolute w-24 h-24 bg-neon-magenta rounded-full blur-2xl -bottom-12 -right-12 animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute w-20 h-20 bg-electric-blue rounded-full blur-xl top-1/2 left-1/4 animate-float" style={{ animationDelay: '2s' }} />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}