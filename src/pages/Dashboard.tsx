import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MetaTags } from "@/components/MetaTags";

export default function DashboardRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const go = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const role = (profile as any)?.role || "artist";
      navigate(role === "producer" ? "/producer-dashboard" : "/artist-dashboard", { replace: true });
    };
    go();
  }, [navigate]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <MetaTags 
        title="Redirecting to Dashboard | BeatPackz"
        description="Taking you to the right dashboard based on your role."
        image="/assets/beat-packz-social-image.png"
      />
      <p className="text-muted-foreground">Redirecting to your dashboard…</p>
    </div>
  );
}
