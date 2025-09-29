import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  const location = useLocation();

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
            try { sessionStorage.setItem('redirectTo', location.pathname + location.search); } catch {}
            navigate("/auth");
          }
          return;
        }

        setUser(session.user);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.warn('Profile fetch error (initial check):', profileError.message);
        }

        if (!mounted) return;

        const role = (profile?.role as 'artist' | 'producer' | null) ?? null;
        if (!role) {
          // Role unresolved: avoid redirecting to prevent route ping-pong
          setLoading(false);
          setInitialLoad(false);
          return;
        }
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
        try { sessionStorage.setItem('redirectTo', location.pathname + location.search); } catch {}
        navigate("/auth");
        return;
      }

      setUser(session.user);

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.warn('Profile fetch error (auth listener):', profileError.message);
        }

        if (!mounted) return;

        const role = (profile?.role as 'artist' | 'producer' | null) ?? null;
        if (!role) {
          // Role unresolved: don't redirect to avoid loops
          setLoading(false);
          return;
        }
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
  }, [navigate, allowedRoles, location.pathname]);

  // Fallback: if user is signed in but role hasn't resolved, send to generic dashboard after a short delay
  useEffect(() => {
    if (user && !userRole) {
      const id = setTimeout(() => {
        navigate('/dashboard');
      }, 1200);
      return () => clearTimeout(id);
    }
  }, [user, userRole, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  if (user && !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Finishing sign-in...</div>
      </div>
    );
  }

  if (!allowedRoles.includes(userRole)) {
    return null; // Will redirect to proper dashboard
  }

  return <>{children}</>;
}