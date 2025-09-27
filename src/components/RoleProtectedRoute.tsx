import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ('artist' | 'producer')[];
}

export function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'artist' | 'producer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // Check current session and role
    const checkUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (!session) {
          // Only redirect on initial load if there's no session
          if (initialLoad) {
            navigate("/auth");
          }
          return;
        }

        setUser(session.user);

        // Get user profile to determine role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (!mounted) return;

        const role = profile?.role || 'artist';
        setUserRole(role);

        // Only redirect on role mismatch if this is not the initial load
        // or if we're certain about the role
        if (!allowedRoles.includes(role) && !initialLoad) {
          navigate(role === 'artist' ? '/artist-dashboard' : '/producer-dashboard');
          return;
        }

        setLoading(false);
        setInitialLoad(false);
      } catch (error) {
        console.error('Error checking user role:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (!mounted) return;

        const role = profile?.role || 'artist';
        setUserRole(role);

        if (!allowedRoles.includes(role)) {
          navigate(role === 'artist' ? '/artist-dashboard' : '/producer-dashboard');
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching user role:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    });

    // Then check current session after a small delay to let auth state settle
    setTimeout(() => {
      if (mounted) {
        checkUserRole();
      }
    }, 100);

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !userRole || !allowedRoles.includes(userRole)) {
    return null; // Will redirect
  }

  return <>{children}</>;
}