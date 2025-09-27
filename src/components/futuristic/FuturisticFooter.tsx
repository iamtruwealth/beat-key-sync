import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Instagram, Twitter, Youtube, Mail, Music, Users, Star } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { GlassMorphismSection } from "./GlassMorphismSection";

export function FuturisticFooter() {
  const navigate = useNavigate();

  return (
    <footer className="relative bg-background border-t border-border/50 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl -top-48 -left-48 animate-float" />
        <div className="absolute w-80 h-80 bg-neon-magenta/10 rounded-full blur-3xl -bottom-40 -right-40 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute w-64 h-64 bg-electric-blue/10 rounded-full blur-2xl top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-float" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-16">
        {/* Producer Signup CTA */}
        <div className="mb-16">
          <GlassMorphismSection variant="neon" className="text-center">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-3xl font-bold gradient-text">
                  Ready to Share Your Beats?
                </h3>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Join thousands of producers earning from their music. Upload your beats and reach a global audience.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
                <Input
                  placeholder="Enter your email"
                  className="glass-morphism border-neon-cyan/30 focus:border-neon-cyan bg-background/50"
                />
                <Button 
                  className="bg-gradient-to-r from-neon-magenta to-neon-purple hover:from-neon-magenta-glow hover:to-neon-purple text-white neon-glow-hover transform hover:scale-105 transition-all duration-300 whitespace-nowrap"
                  onClick={() => navigate("/auth")}
                >
                  Start Selling
                </Button>
              </div>

              <div className="flex justify-center space-x-8 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <Music className="w-4 h-4 text-neon-cyan" />
                  <span>Unlimited Uploads</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-neon-magenta" />
                  <span>Global Reach</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-electric-blue" />
                  <span>Premium Support</span>
                </div>
              </div>
            </div>
          </GlassMorphismSection>
        </div>

        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-black tracking-wider mb-2">
                <span className="gradient-text">BEAT</span>
                <span className="text-neon-cyan">PACKZ</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                The future of beat production and music collaboration.
              </p>
            </div>
            
            <div className="flex space-x-4">
              <SocialLink icon={Instagram} href="#" />
              <SocialLink icon={Twitter} href="#" />
              <SocialLink icon={Youtube} href="#" />
              <SocialLink icon={Mail} href="#" />
            </div>
          </div>

          {/* Platform */}
          <div className="space-y-4">
            <h3 className="font-semibold text-neon-cyan">Platform</h3>
            <div className="space-y-2 text-sm">
              <FooterLink onClick={() => navigate("/explore")}>Explore Beats</FooterLink>
              <FooterLink onClick={() => navigate("/browse-producers")}>Producers</FooterLink>
              <FooterLink onClick={() => navigate("/beat-packs")}>Beat Packs</FooterLink>
              <FooterLink onClick={() => navigate("/pricing")}>Pricing</FooterLink>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="font-semibold text-neon-cyan">Resources</h3>
            <div className="space-y-2 text-sm">
              <FooterLink onClick={() => navigate("/faq")}>FAQ</FooterLink>
              <FooterLink onClick={() => navigate("/about")}>About</FooterLink>
              <FooterLink href="#">Help Center</FooterLink>
              <FooterLink href="#">Community</FooterLink>
            </div>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="font-semibold text-neon-cyan">Legal</h3>
            <div className="space-y-2 text-sm">
              <FooterLink onClick={() => navigate("/terms")}>Terms of Service</FooterLink>
              <FooterLink href="#">Privacy Policy</FooterLink>
              <FooterLink href="#">Cookie Policy</FooterLink>
              <FooterLink href="#">Licensing</FooterLink>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border/50 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-muted-foreground">
              © 2024 BeatPackz. All rights reserved.
            </div>
            <div className="text-sm text-muted-foreground">
              Made with{" "}
              <span className="text-neon-magenta animate-glow-pulse">♪</span>{" "}
              for music creators worldwide
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ icon: Icon, href }: { icon: any; href: string }) {
  return (
    <a
      href={href}
      className="w-10 h-10 glass-morphism rounded-full flex items-center justify-center text-muted-foreground hover:text-neon-cyan hover:shadow-lg hover:shadow-neon-cyan/30 transition-all duration-300 transform hover:scale-110"
    >
      <Icon className="w-4 h-4" />
    </a>
  );
}

function FooterLink({ 
  children, 
  href, 
  onClick 
}: { 
  children: React.ReactNode; 
  href?: string; 
  onClick?: () => void; 
}) {
  const baseClasses = "text-muted-foreground hover:text-neon-cyan transition-colors duration-300 cursor-pointer";
  
  if (onClick) {
    return (
      <button onClick={onClick} className={baseClasses}>
        {children}
      </button>
    );
  }
  
  return (
    <Link to={href} className={baseClasses}>
      {children}
    </Link>
  );
}