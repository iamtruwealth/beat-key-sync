import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useOnboardingStatus(userId: string | undefined, userRole: 'producer' | 'artist' | null) {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [isOnboardingSkipped, setIsOnboardingSkipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !userRole) {
      setLoading(false);
      return;
    }

    // Artists skip onboarding
    if (userRole === 'artist') {
      setIsOnboardingComplete(true);
      setLoading(false);
      return;
    }

    checkOnboardingStatus();
  }, [userId, userRole]);

  const checkOnboardingStatus = async () => {
    if (!userId || userRole !== 'producer') return;

    try {
      // Get producer guide
      const { data: guide, error: guideError } = await supabase
        .from('onboarding_guides')
        .select('id')
        .eq('role', 'producer')
        .eq('is_active', true)
        .maybeSingle();

      console.log('[OnboardingStatus] guide:', { guide, guideError });

      if (!guide || guideError) {
        setIsOnboardingComplete(true);
        setLoading(false);
        return;
      }

      // Check user progress
      const { data: progress, error: progressError } = await supabase
        .from('user_onboarding_progress')
        .select('is_completed, is_skipped')
        .eq('user_id', userId)
        .eq('guide_id', guide.id)
        .maybeSingle();

      console.log('[OnboardingStatus] progress:', { progress, progressError });

      if (progress) {
        setIsOnboardingComplete(progress.is_completed);
        setIsOnboardingSkipped(progress.is_skipped);
      } else {
        // No progress record means onboarding not started
        setIsOnboardingComplete(false);
        setIsOnboardingSkipped(false);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // On error, assume onboarding is complete to avoid blocking users
      setIsOnboardingComplete(true);
    } finally {
      setLoading(false);
    }
  };

  const markOnboardingComplete = async () => {
    if (!userId || userRole !== 'producer') return;

    try {
      const { data: guide } = await supabase
        .from('onboarding_guides')
        .select('id')
        .eq('role', 'producer')
        .eq('is_active', true)
        .maybeSingle();

      if (guide) {
        await supabase
          .from('user_onboarding_progress')
          .upsert({
            user_id: userId,
            guide_id: guide.id,
            is_completed: true,
            completed_at: new Date().toISOString()
          });

        setIsOnboardingComplete(true);
      }
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }
  };

  return {
    isOnboardingComplete: isOnboardingComplete || isOnboardingSkipped,
    needsOnboarding: userRole === 'producer' && !isOnboardingComplete && !isOnboardingSkipped,
    loading,
    markOnboardingComplete
  };
}