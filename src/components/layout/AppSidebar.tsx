import { Home, Music, Users, User, Settings, Upload, FolderOpen, Compass, LogIn, LogOut } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
const navigation = [{
  title: "Dashboard",
  url: "/dashboard",
  icon: Home
}, {
  title: "Library",
  url: "/library",
  icon: Music
}, {
  title: "Beat Packs",
  url: "/projects",
  icon: FolderOpen
}, {
  title: "Explore",
  url: "/explore",
  icon: Compass
}, {
  title: "Shared",
  url: "/shared",
  icon: Users
}];
const tools = [{
  title: "Upload",
  url: "/upload",
  icon: Upload
}, {
  title: "Account",
  url: "/account",
  icon: User
}, {
  title: "Settings",
  url: "/settings",
  icon: Settings
}];
export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const [user, setUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);
  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) => 
    isActive ? "bg-sidebar-accent text-sidebar-primary font-medium shadow-sm" : "hover:bg-sidebar-accent/50 text-sidebar-foreground";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };
  return <Sidebar className={`${collapsed ? "w-14" : "w-64"} border-r border-sidebar-border`} collapsible="icon">
      <SidebarContent className="bg-sidebar-background">
        {/* Logo/Brand */}
        <div className="p-4 border-b border-sidebar-border">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/")}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
              <Music className="w-5 h-5 text-primary-foreground" />
            </div>
            {!collapsed && <div className="text-sidebar-foreground font-semibold">BeatPackz</div>}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs uppercase tracking-wide">
            {!collapsed && "Navigate"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs uppercase tracking-wide">
            {!collapsed && "Tools"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tools.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Auth Section */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {user ? (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleSignOut}>
                    <LogOut className="w-4 h-4" />
                    {!collapsed && <span>Sign Out</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/auth" className={getNavCls}>
                      <LogIn className="w-4 h-4" />
                      {!collapsed && <span>Sign In</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>;
}