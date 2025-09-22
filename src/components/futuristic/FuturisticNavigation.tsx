import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, User, Music, Search, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User as UserType } from "@supabase/supabase-js";

export function FuturisticNavigation() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const goToDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const role = (profile as any)?.role || 'artist';
    navigate(role === 'producer' ? '/producer-dashboard' : '/artist-dashboard');
  };

  const navItems = [
    { label: "Feed Me Beatz", href: "/feed-me-beatz", icon: Radio },
    { label: "Explore", href: "/explore", icon: Search },
    { label: "Producers", href: "/browse-producers", icon: User },
    { label: "Beat Packs", href: "/beat-packs", icon: Music },
    { label: "Pricing", href: "/pricing", icon: Music },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? "glass-morphism backdrop-blur-md border-b border-neon-cyan/20 shadow-lg shadow-neon-cyan/10" 
        : "bg-transparent"
    }`}>
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div 
            className="cursor-pointer group"
            onClick={() => navigate("/")}
          >
            <h1 className="text-2xl font-black tracking-wider">
              <span className="gradient-text group-hover:animate-glitch">BEAT</span>
              <span className="text-neon-cyan">PACKZ</span>
            </h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.href)}
                className="relative text-foreground hover:text-neon-cyan transition-colors duration-300 group"
              >
                <div className="flex items-center space-x-2">
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-neon-cyan group-hover:w-full transition-all duration-300" />
              </button>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <Button
                variant="outline"
                onClick={goToDashboard}
                className="border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-background neon-glow-hover"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/auth")}
                  className="text-foreground hover:text-neon-cyan"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => navigate("/auth")}
                  className="bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue-glow neon-glow-hover ripple"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-foreground hover:text-neon-cyan transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 glass-morphism rounded-lg p-4 animate-slide-up">
            <div className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    navigate(item.href);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-2 text-foreground hover:text-neon-cyan transition-colors py-2"
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              ))}
              <hr className="border-border" />
              {user ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    await goToDashboard();
                    setIsMobileMenuOpen(false);
                  }}
                  className="border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-background"
                >
                  Dashboard
                </Button>
              ) : (
                <div className="flex flex-col space-y-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      navigate("/auth");
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-foreground hover:text-neon-cyan"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={() => {
                      navigate("/auth");
                      setIsMobileMenuOpen(false);
                    }}
                    className="bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue-glow"
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}