import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { MetaTags } from "@/components/MetaTags";

export default function FAQ() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const navigateToUserDashboard = () => {
    if (user?.user_metadata?.role === 'artist') {
      navigate('/artist-dashboard');
    } else {
      navigate('/producer-dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MetaTags 
        title="FAQ | BeatPackz - Frequently Asked Questions"
        description="Get answers to common questions about BeatPackz. Learn how to upload beats, manage your account, set prices, track sales, and more."
        url="https://beatpackz.com/faq"
      />
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate("/")}>
              <video src="/logo.mp4" className="w-8 h-8" autoPlay loop muted playsInline />
              <span className="text-2xl font-bold text-foreground">BeatPackz</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => navigate("/#discover")} className="text-muted-foreground hover:text-foreground transition-colors">
                Discover Beats
              </button>
              <button onClick={() => navigate("/pricing")} className="text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </button>
              {user && (
                <Button variant="ghost" onClick={navigateToUserDashboard} className="text-brand-blue hover:text-brand-blue-glow font-semibold">
                  Dashboard
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <Button onClick={navigateToUserDashboard} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-6">
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate("/auth")} className="text-foreground hover:text-brand-blue">
                    Log In
                  </Button>
                  <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-6">
                    Sign Up Free
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Banner */}
      <section className="relative py-20 px-4 text-center bg-gradient-to-r from-brand-blue-deep to-brand-blue overflow-hidden mt-16">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8">
            Everything you need to know about BeatPackz
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
            Beatpackz.store FAQs
          </h2>
          
          <div className="space-y-8">
            {[
              {
                q: "What is Beatpackz.store?",
                a: "Beatpackz.store is a professional platform for music producers to upload, sell, and share their beats. You can create beat packs, set your own prices, offer free downloads, and track sales and revenue all in one place."
              },
              {
                q: "How does AI analyze my beats?",
                a: "When you upload a beat, our AI automatically detects the BPM and musical key. This helps buyers find your beats more easily and saves you time from manually labeling each file."
              },
              {
                q: "Can I set my own prices or offer free downloads?",
                a: "Yes! You can set individual prices for each beat or offer it as a free download. For paid beats, a 12% platform fee is added on top of the price and is paid by the buyer. Paid beats are processed securely via Stripe, PayPal, Venmo, or Cash App."
              },
              {
                q: "How do beat packs work?",
                a: "You can bundle multiple beats into a beat pack and share it with a single link. Each link includes an interactive audio player that shows pricing and free download availability, and works on phones, tablets, and computers."
              },
              {
                q: "How do I get paid for my beats?",
                a: "You receive the full amount you set for your beats directly to your payout method (Stripe, PayPal, Venmo, or Cash App). The 12% platform fee is added to the buyer's total, so your earnings aren't reduced."
              },
              {
                q: "Can I track my revenue and sales?",
                a: "Yes! The platform provides a dashboard where you can see real-time sales, revenue, and recent purchases for each beat or beat pack."
              },
              {
                q: "Can I message other producers?",
                a: "Yes! Beatpackz.store includes a messaging system so you can communicate, collaborate, or network with other producers directly on the platform."
              },
              {
                q: "Can I update my beats or pricing later?",
                a: "Absolutely. You can edit beat titles, prices, free/download status, or even replace the audio file. Paid beats automatically update the corresponding Stripe product pricing."
              },
              {
                q: "Will my beat pack links work on mobile devices?",
                a: "Yes. All beat pack links include a responsive audio player that works on phones, tablets, and computers. Buyers can listen, preview, and purchase beats without downloading files."
              },
              {
                q: "How much is the platform fee?",
                a: "Beatpackz.store adds a 12% platform fee on top of the beat price, which is paid by the buyer. For example, if your beat is $50, the buyer pays $56, and you receive the full $50 directly to your payout method."
              },
              {
                q: "Is my sales data private?",
                a: "Yes! All sales and revenue data is only visible to you in your producer dashboard. Other users cannot see your earnings or sales history."
              },
              {
                q: "Can I create multiple accounts?",
                a: "Free users are limited to 1 account per IP address, while pro users can create up to 3 accounts. This prevents abuse while allowing legitimate multiple accounts."
              }
            ].map((faq, index) => (
              <Card key={index} className="border shadow-sm">
                <CardContent className="p-8">
                  <h3 className="text-xl font-semibold text-foreground mb-4">
                    {index + 1}. {faq.q}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {faq.a}
                  </p>
                  {index < 11 && (
                    <div className="mt-6 text-center">
                      <span className="text-muted-foreground text-sm">⸻</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-16">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-12 py-4 text-xl shadow-xl shadow-brand-blue/40"
            >
              Get Started Today
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}