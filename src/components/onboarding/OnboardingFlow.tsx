import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, SkipForward, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OnboardingStep {
  id: string;
  step_number: number;
  title: string;
  content: string;
  route: string;
}

interface OnboardingGuide {
  id: string;
  role: string;
  title: string;
  description: string;
}

interface OnboardingFlowProps {
  userRole: 'producer' | 'artist';
  userId: string;
  onComplete?: () => void;
}

export function OnboardingFlow({ userRole, userId, onComplete }: OnboardingFlowProps) {
  const [guide, setGuide] = useState<OnboardingGuide | null>(null);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (userRole === 'artist') {
      // Artists skip onboarding
      onComplete?.();
      return;
    }
    
    loadOnboardingData();
  }, [userRole, userId]);

  const loadOnboardingData = async () => {
    try {
      // Get the guide for the user's role
      const { data: guideData, error: guideError } = await supabase
        .from('onboarding_guides')
        .select('*')
        .eq('role', userRole)
        .eq('is_active', true)
        .single();

      if (guideError || !guideData) {
        console.error('No onboarding guide found for role:', userRole, guideError);
        // Instead of calling onComplete, just set loading to false and show a fallback
        setLoading(false);
        return;
      }

      setGuide(guideData);

      // Get steps for this guide
      const { data: stepsData, error: stepsError } = await supabase
        .from('onboarding_steps')
        .select('*')
        .eq('guide_id', guideData.id)
        .eq('is_active', true)
        .order('step_number');

      if (stepsError) throw stepsError;
      setSteps(stepsData || []);

      // Check for existing progress
      const { data: progressData } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('guide_id', guideData.id)
        .single();

      if (progressData) {
        setCurrentStep(progressData.current_step);
        setCompletedSteps(progressData.completed_steps || []);
        setIsCompleted(progressData.is_completed);
        
        if (progressData.is_completed || progressData.is_skipped) {
          onComplete?.();
          return;
        }
      } else {
        // Create initial progress record
        await supabase
          .from('user_onboarding_progress')
          .insert({
            user_id: userId,
            guide_id: guideData.id,
            current_step: 1,
            completed_steps: []
          });
      }
    } catch (error) {
      console.error('Error loading onboarding data:', error);
      toast({
        title: "Error",
        description: "Failed to load onboarding guide",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (step: number, completed: boolean = false) => {
    if (!guide) return;

    const newCompletedSteps = completed && !completedSteps.includes(step) 
      ? [...completedSteps, step] 
      : completedSteps;

    try {
      await supabase
        .from('user_onboarding_progress')
        .update({
          current_step: step,
          completed_steps: newCompletedSteps,
          is_completed: completed && step === steps.length,
          completed_at: completed && step === steps.length ? new Date().toISOString() : null
        })
        .eq('user_id', userId)
        .eq('guide_id', guide.id);

      setCurrentStep(step);
      setCompletedSteps(newCompletedSteps);
      
      if (completed && step === steps.length) {
        setIsCompleted(true);
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const nextStep = () => {
    const newStep = Math.min(currentStep + 1, steps.length);
    updateProgress(newStep, newStep === steps.length);
    
    if (newStep <= steps.length) {
      const stepData = steps[newStep - 1];
      if (stepData && stepData.route) {
        navigate(stepData.route);
      }
    }
  };

  const skipOnboarding = async () => {
    if (!guide) return;

    try {
      await supabase
        .from('user_onboarding_progress')
        .update({
          is_skipped: true,
          completed_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('guide_id', guide.id);

      onComplete?.();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
  };

  const finishOnboarding = () => {
    navigate('/producer-dashboard');
    onComplete?.();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading onboarding...</div>
      </div>
    );
  }

  if (!guide || steps.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Onboarding Not Available</CardTitle>
            <CardDescription>
              No onboarding guide is currently configured. You can proceed to your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/producer-dashboard')} className="w-full">
              Go to Producer Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepData = steps[currentStep - 1];
  const progressPercentage = (currentStep / steps.length) * 100;

  if (isCompleted || currentStep > steps.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Congratulations!</CardTitle>
            <CardDescription>
              You've completed the onboarding process. You're all set to start creating and selling beats!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={finishOnboarding} className="w-full">
              Go to Producer Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 py-8">
      <div className="container max-w-2xl mx-auto px-4">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{guide.title}</h1>
            <Button variant="ghost" onClick={skipOnboarding}>
              <SkipForward className="w-4 h-4 mr-2" />
              Skip
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{currentStep} of {steps.length}</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </div>

        {/* Current Step */}
        <Card>
          <CardHeader>
            <CardTitle>{currentStepData.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              {currentStepData.content}
            </p>
            
            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={skipOnboarding}
              >
                Skip Onboarding
              </Button>
              <Button onClick={nextStep}>
                {currentStep === steps.length ? 'Finish' : 'Next Step'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Steps Overview */}
        <div className="mt-8 grid gap-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`p-4 rounded-lg border transition-colors ${
                index + 1 === currentStep
                  ? 'border-primary bg-primary/5'
                  : completedSteps.includes(index + 1)
                  ? 'border-green-200 bg-green-50'
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    completedSteps.includes(index + 1)
                      ? 'bg-green-100 text-green-600'
                      : index + 1 === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {completedSteps.includes(index + 1) ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}