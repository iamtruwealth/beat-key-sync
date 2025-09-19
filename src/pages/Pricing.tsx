import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import beatpackzLogo from "@/assets/beatpackz-logo.png";

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleProPlanClick = async () => {
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Create checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) {
        toast({
          title: "Error",
          description: "Failed to create checkout session. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const plans = [
    {
      name: "Free Plan",
      price: "Free",
      isPopular: false,
      features: [
        "Upload up to 10 tracks",
        "Create 1 Beat Pack"
      ]
    },
    {
      name: "Pro Plan",
      price: "$9.99",
      period: "/ month",
      isPopular: true,
      features: [
        "Unlimited uploads",
        "Unlimited Beat Packs"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <video src="/logo.mp4" className="w-8 h-8" autoPlay loop muted playsInline />
              <span className="text-2xl font-bold text-foreground">BeatPackz</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate("/")} className="text-foreground hover:text-brand-blue">
                Back to Home
              </Button>
              <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-6">
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20">
        <div className="container mx-auto px-6 py-16">
          {/* Logo Section */}
          <div className="text-center mb-16">
            <div className="flex justify-center mb-8">
              <img 
                src={beatpackzLogo} 
                alt="BeatPackz Logo" 
                className="w-64 h-64 object-contain"
              />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Choose Your Plan
            </h1>
            
            {/* Important Note */}
            <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-lg p-4 max-w-2xl mx-auto mb-12">
              <p className="text-foreground text-lg font-medium">
                Artists always sign up free. Pricing below applies only to Producer Accounts.
              </p>
            </div>
          </div>

          {/* Pricing Table */}
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {plans.map((plan, index) => (
                <Card 
                  key={index} 
                  className={`relative transition-all duration-300 hover:scale-105 ${
                    plan.isPopular 
                      ? 'border-brand-blue shadow-lg shadow-brand-blue/20 bg-gradient-to-br from-card to-brand-blue/5' 
                      : 'border-border bg-card'
                  }`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-brand-blue-deep to-brand-blue text-white px-4 py-1 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl font-bold text-foreground mb-2">
                      {plan.name}
                    </CardTitle>
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-foreground">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-muted-foreground ml-1">
                          {plan.period}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center gap-3">
                          <Check className="w-5 h-5 text-brand-blue flex-shrink-0" />
                          <span className="text-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      className={`w-full py-3 text-lg font-semibold ${
                        plan.isPopular
                          ? 'bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white shadow-lg shadow-brand-blue/30'
                          : 'border-brand-blue text-brand-blue hover:bg-gradient-to-r hover:from-brand-blue-deep hover:to-brand-blue hover:text-white'
                      }`}
                      variant={plan.isPopular ? "default" : "outline"}
                      onClick={plan.isPopular ? handleProPlanClick : () => navigate("/auth")}
                    >
                      {plan.isPopular ? "Start Pro Subscription" : "Get Started as Producer"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Additional Info */}
          <div className="text-center mt-16">
            <p className="text-muted-foreground mb-4">
              Need help choosing? Contact our support team
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/auth")} className="text-brand-blue hover:text-brand-blue-glow">
                Sign Up as Artist (Free)
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}