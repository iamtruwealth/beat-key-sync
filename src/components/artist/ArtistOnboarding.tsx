import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowRight, X, Music, DollarSign, Users, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  completed: boolean;
  action: () => void;
  actionLabel: string;
}

export function ArtistOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);

  useEffect(() => {
    loadOnboardingStatus();
  }, []);

  const loadOnboardingStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check EPK creation
      const { data: epkData } = await supabase
        .from('artist_epk_profiles')
        .select('id, slug')
        .eq('artist_id', user.id)
        .maybeSingle();

      // Check payment methods
      const { count: paymentCount } = await supabase
        .from('artist_payment_methods')
        .select('*', { count: 'exact', head: true })
        .eq('artist_id', user.id);

      // Check subscription tiers
      const { count: tiersCount } = await supabase
        .from('fan_subscription_tiers')
        .select('*', { count: 'exact', head: true })
        .eq('artist_id', user.id);

      // Check if EPK has modules
      const { count: modulesCount } = epkData ? await supabase
        .from('epk_modules')
        .select('*', { count: 'exact', head: true })
        .eq('epk_profile_id', epkData.id) : { count: 0 };

      const onboardingSteps: OnboardingStep[] = [
        {
          id: 'create_epk',
          title: 'Create Your EPK',
          description: 'Set up your Electronic Press Kit to showcase your music and brand',
          icon: Music,
          completed: !!epkData,
          action: () => navigate('/epk'),
          actionLabel: epkData ? 'View EPK' : 'Create EPK'
        },
        {
          id: 'add_content',
          title: 'Add EPK Content',
          description: 'Add your bio, music, photos, and other modules to your EPK',
          icon: FileText,
          completed: (modulesCount || 0) > 0,
          action: () => navigate('/epk'),
          actionLabel: 'Add Content'
        },
        {
          id: 'setup_subscriptions',
          title: 'Enable Fan Subscriptions',
          description: 'Set up subscription tiers to monetize your fanbase',
          icon: Users,
          completed: (tiersCount || 0) > 0,
          action: () => {
            // Scroll to subscriptions tab
            const subscriptionsTab = document.querySelector('[value="subscriptions"]');
            if (subscriptionsTab) {
              (subscriptionsTab as HTMLElement).click();
            }
          },
          actionLabel: 'Setup Subscriptions'
        },
        {
          id: 'payment_info',
          title: 'Add Payment Method',
          description: 'Add your payout information to receive earnings',
          icon: DollarSign,
          completed: (paymentCount || 0) > 0,
          action: () => {
            // Scroll to payment methods section
            const paymentSection = document.querySelector('[class*="PaymentMethodsManager"]');
            if (paymentSection) {
              paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          },
          actionLabel: 'Add Payment Method'
        }
      ];

      setSteps(onboardingSteps);

      // Check if user has dismissed onboarding
      const dismissed = localStorage.getItem(`artist_onboarding_dismissed_${user.id}`);
      const allCompleted = onboardingSteps.every(step => step.completed);
      
      setVisible(!dismissed && !allCompleted);
    } catch (error) {
      console.error('Error loading onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      localStorage.setItem(`artist_onboarding_dismissed_${user.id}`, 'true');
    }
    setVisible(false);
    toast({
      title: "Onboarding hidden",
      description: "You can always find guidance in each section"
    });
  };

  if (loading || !visible) return null;

  const completedSteps = steps.filter(s => s.completed).length;
  const progress = (completedSteps / steps.length) * 100;
  const allCompleted = completedSteps === steps.length;

  return (
    <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {allCompleted ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Setup Complete!
                </>
              ) : (
                <>
                  <Music className="w-5 h-5" />
                  Welcome to Beat Packz!
                </>
              )}
            </CardTitle>
            <CardDescription>
              {allCompleted 
                ? "You're all set up and ready to start earning from your music!" 
                : `Complete these steps to get started (${completedSteps}/${steps.length} done)`}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="mt-4" />
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                step.completed 
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' 
                  : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                step.completed 
                  ? 'bg-green-600 text-white' 
                  : 'bg-primary/10 text-primary'
              }`}>
                {step.completed ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{step.title}</h4>
                  {step.completed && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      ✓ Complete
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              
              {!step.completed && (
                <Button
                  onClick={step.action}
                  size="sm"
                  className="flex-shrink-0"
                >
                  {step.actionLabel}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          );
        })}

        {allCompleted && (
          <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <h4 className="font-semibold mb-2">🎉 You&apos;re All Set!</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Your artist profile is complete. Now you can start sharing your EPK and earning from your music!
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/epk')} size="sm">
                View My EPK
              </Button>
              <Button onClick={handleDismiss} variant="outline" size="sm">
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}