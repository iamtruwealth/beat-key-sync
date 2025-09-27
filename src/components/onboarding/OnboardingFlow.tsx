import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, SkipForward, CheckCircle, Play, Zap, Upload, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GlassMorphismSection } from "@/components/futuristic/GlassMorphismSection";
import { ScrollAnimationWrapper } from "@/components/futuristic/ScrollAnimationWrapper";

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
        
        // If already completed or skipped, redirect immediately
        if (progressData.is_completed || progressData.is_skipped) {
          console.log('Onboarding already complete, redirecting to dashboard');
          navigate('/producer-dashboard');
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

  const nextStep = async () => {
    if (!guide) return;
    
    const newStep = Math.min(currentStep + 1, steps.length);
    const isCompleting = newStep === steps.length;
    
    try {
      // Update progress in database
      await supabase
        .from('user_onboarding_progress')
        .update({
          current_step: newStep,
          completed_steps: [...completedSteps, currentStep],
          is_completed: isCompleting,
          completed_at: isCompleting ? new Date().toISOString() : null
        })
        .eq('user_id', userId)
        .eq('guide_id', guide.id);

      // Update local state
      setCurrentStep(newStep);
      setCompletedSteps([...completedSteps, currentStep]);
      
      if (isCompleting) {
        setIsCompleted(true);
        // Navigate to producer dashboard after completion
        setTimeout(() => {
          navigate('/producer-dashboard');
        }, 2000);
      } else {
        // Navigate to the route for the next step if it exists
        const stepData = steps[newStep - 1];
        if (stepData?.route && stepData.route !== '/onboarding') {
          navigate(stepData.route);
        }
      }
    } catch (error) {
      console.error('Error updating onboarding progress:', error);
      toast({
        title: "Error",
        description: "Failed to update progress. Please try again.",
        variant: "destructive"
      });
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

      navigate('/producer-dashboard');
      onComplete?.();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      toast({
        title: "Error", 
        description: "Failed to skip onboarding. Please try again.",
        variant: "destructive"
      });
    }
  };

  const finishOnboarding = () => {
    navigate('/producer-dashboard');
    onComplete?.();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-neon-cyan to-electric-blue rounded-full animate-glow-pulse"></div>
          <div className="text-lg text-electric-blue animate-pulse">Initializing your journey...</div>
        </div>
      </div>
    );
  }

  if (!guide || steps.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-background relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl -top-48 -left-48 animate-float"></div>
          <div className="absolute w-64 h-64 bg-electric-blue/10 rounded-full blur-2xl -bottom-32 -right-32 animate-float" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <GlassMorphismSection variant="neon" className="w-full max-w-md mx-4">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-r from-neon-cyan to-electric-blue rounded-full flex items-center justify-center">
              <Zap className="w-10 h-10 text-background" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text mb-2">Ready to Create</h1>
              <p className="text-muted-foreground">
                No onboarding guide is currently configured. You can proceed to your dashboard.
              </p>
            </div>
            <Button 
              onClick={() => navigate('/producer-dashboard')} 
              className="w-full bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue-glow text-background font-semibold ripple"
            >
              Enter Producer Dashboard
            </Button>
          </div>
        </GlassMorphismSection>
      </div>
    );
  }

  const currentStepData = steps[currentStep - 1];
  const progressPercentage = (currentStep / steps.length) * 100;

  if (isCompleted || currentStep > steps.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-background relative overflow-hidden">
        {/* Success animation background */}
        <div className="absolute inset-0">
          <div className="absolute w-96 h-96 bg-neon-green/20 rounded-full blur-3xl top-1/4 left-1/4 animate-float"></div>
          <div className="absolute w-64 h-64 bg-neon-cyan/15 rounded-full blur-2xl bottom-1/4 right-1/4 animate-float" style={{ animationDelay: '1.5s' }}></div>
          <div className="absolute w-32 h-32 bg-electric-blue/10 rounded-full blur-xl top-3/4 left-1/2 animate-float" style={{ animationDelay: '0.5s' }}></div>
        </div>
        
        <ScrollAnimationWrapper animation="scale-in">
          <GlassMorphismSection variant="gradient" className="w-full max-w-md mx-4">
            <div className="text-center space-y-8">
              <div className="relative">
                <div className="mx-auto w-20 h-20 bg-gradient-to-r from-neon-green to-neon-cyan rounded-full flex items-center justify-center animate-glow-pulse">
                  <CheckCircle className="w-10 h-10 text-background" />
                </div>
                <div className="absolute -inset-4 bg-gradient-to-r from-neon-green to-neon-cyan rounded-full opacity-20 animate-ping"></div>
              </div>
              
              <div className="space-y-4">
                <h1 className="text-3xl font-bold gradient-text typing-effect">Mission Complete!</h1>
                <p className="text-muted-foreground leading-relaxed">
                  You've mastered the fundamentals. Time to unleash your creativity and start earning from your beats!
                </p>
              </div>
              
              <Button 
                onClick={finishOnboarding} 
                className="w-full bg-gradient-to-r from-neon-green to-neon-cyan hover:from-neon-green/80 hover:to-neon-cyan/80 text-background font-semibold py-6 text-lg ripple neon-glow-hover"
              >
                <Play className="w-5 h-5 mr-2" />
                Launch Producer Studio
              </Button>
            </div>
          </GlassMorphismSection>
        </ScrollAnimationWrapper>
      </div>
    );
  }

  const getStepIcon = (stepNumber: number) => {
    const icons = [Upload, Play, DollarSign, Zap];
    const IconComponent = icons[stepNumber - 1] || Zap;
    return IconComponent;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl -top-48 -left-48 animate-float"></div>
        <div className="absolute w-64 h-64 bg-electric-blue/10 rounded-full blur-2xl top-1/2 -right-32 animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute w-48 h-48 bg-neon-magenta/5 rounded-full blur-xl bottom-0 left-1/4 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-8 relative z-10">
        {/* Futuristic Header */}
        <ScrollAnimationWrapper animation="slide-up" className="mb-12">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-neon-cyan/20 to-electric-blue/20 rounded-full border border-neon-cyan/30">
              <Zap className="w-5 h-5 text-neon-cyan" />
              <span className="text-neon-cyan font-medium">Producer Onboarding</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-4">
              {guide.title}
            </h1>
            
            <div className="max-w-xl mx-auto">
              <div className="flex justify-between text-sm text-muted-foreground mb-3">
                <span>Mission Progress</span>
                <span className="text-electric-blue font-medium">{currentStep} of {steps.length}</span>
              </div>
              <div className="relative">
                <Progress value={progressPercentage} className="h-3 bg-card/50" />
                <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan to-electric-blue rounded-full opacity-80" 
                     style={{ width: `${progressPercentage}%` }}></div>
              </div>
            </div>
          </div>
        </ScrollAnimationWrapper>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <ScrollAnimationWrapper animation="scale-in" delay={200}>
              <GlassMorphismSection variant="gradient" className="space-y-8">
                {/* Current Step Header */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-neon-cyan to-electric-blue rounded-xl flex items-center justify-center">
                    {React.createElement(getStepIcon(currentStep), { className: "w-6 h-6 text-background" })}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-electric-blue">{currentStepData.title}</h2>
                    <p className="text-sm text-muted-foreground">Step {currentStep} of {steps.length}</p>
                  </div>
                </div>

                {/* Content */}
                <div className="prose prose-invert max-w-none">
                  <p className="text-lg leading-relaxed text-foreground/90">
                    {currentStepData.content}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <Button 
                    variant="outline" 
                    onClick={skipOnboarding}
                    className="border-border/50 hover:border-neon-cyan/50 hover:bg-neon-cyan/10"
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Skip Tutorial
                  </Button>
                  
                  <Button 
                    onClick={nextStep}
                    className="bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue-glow text-background font-semibold ripple flex-1"
                  >
                    {currentStep === steps.length ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Complete Mission
                      </>
                    ) : (
                      <>
                        Continue Journey
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </GlassMorphismSection>
            </ScrollAnimationWrapper>
          </div>

          {/* Steps Sidebar */}
          <div className="space-y-4">
            <ScrollAnimationWrapper animation="slide-left" delay={400}>
              <h3 className="text-lg font-semibold text-electric-blue mb-4">Mission Roadmap</h3>
            </ScrollAnimationWrapper>
            
            {steps.map((step, index) => {
              const isActive = index + 1 === currentStep;
              const isCompleted = completedSteps.includes(index + 1);
              const StepIcon = getStepIcon(index + 1);
              
              return (
                <ScrollAnimationWrapper 
                  key={step.id} 
                  animation="slide-left" 
                  delay={500 + (index * 100)}
                >
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 ${
                      isActive
                        ? 'border-neon-cyan/50 bg-gradient-to-r from-neon-cyan/5 to-electric-blue/5 neon-glow'
                        : isCompleted
                        ? 'border-neon-green/30 bg-neon-green/5'
                        : 'border-border/30 bg-card/30 hover:border-border/50'
                    }`}
                  >
                    {/* Connection Line */}
                    {index < steps.length - 1 && (
                      <div className={`absolute left-6 top-12 w-0.5 h-8 transition-colors ${
                        isCompleted ? 'bg-neon-green' : 'bg-border/30'
                      }`}></div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                          isCompleted
                            ? 'bg-gradient-to-r from-neon-green to-neon-cyan text-background'
                            : isActive
                            ? 'bg-gradient-to-r from-neon-cyan to-electric-blue text-background animate-glow-pulse'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <StepIcon className="w-4 h-4" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium transition-colors ${
                          isActive ? 'text-electric-blue' : isCompleted ? 'text-neon-green' : 'text-foreground'
                        }`}>
                          {step.title}
                        </h4>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {step.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </ScrollAnimationWrapper>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}