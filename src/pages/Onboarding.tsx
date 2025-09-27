import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { MetaTags } from "@/components/MetaTags";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function Onboarding() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'producer' | 'artist' | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUser(user);

      // Get user profile to determine role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role || 'artist';
      setUserRole(role);

      // If artist, redirect to dashboard immediately
      if (role === 'artist') {
        navigate('/artist-dashboard');
      }
    };

    loadUserData();
  }, [navigate]);

  const handleOnboardingComplete = () => {
    if (userRole === 'producer') {
      navigate('/producer-dashboard');
    } else {
      navigate('/artist-dashboard');
    }
  };

  if (!user || !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <MetaTags 
        title="Get Started | BeatPackz"
        description="Welcome to BeatPackz! Let's get you set up to start creating and sharing your beats."
      />
      
      <OnboardingFlow 
        userRole={userRole}
        userId={user.id}
        onComplete={handleOnboardingComplete}
      />
    </ProtectedRoute>
  );
}