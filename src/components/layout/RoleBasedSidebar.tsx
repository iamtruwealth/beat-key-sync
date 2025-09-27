import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  MessageSquare, 
  FileText, 
  Music, 
  User as UserIcon, 
  Bell,
  Upload,
  Library,
  Users,
  Settings,
  LogOut,
  Headphones,
  Mic,
  Zap
} from "lucide-react";

type UserRole = 'artist' | 'producer';

interface NavigationItem {
  title: string;
  url: string;
  icon: React.ComponentType<any>;
}

export function RoleBasedSidebar() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('artist');
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  useEffect(() => {
    // Get current user and role
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        // Get user profile to determine role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile?.role) {
          setUserRole(profile.role);
        }
      }
    };

    getCurrentUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.role) {
          setUserRole(profile.role);
        }
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const artistNavigation: NavigationItem[] = [
    { title: "Dashboard", url: "/artist-dashboard", icon: LayoutDashboard },
    { title: "Browse Producers", url: "/explore", icon: Users },
    { title: "Messages", url: "/messages", icon: MessageSquare },
    { title: "Paperwork", url: "/paperwork", icon: FileText },
  ];

  const producerNavigation: NavigationItem[] = [
    { title: "Dashboard", url: "/producer-dashboard", icon: LayoutDashboard },
    { title: "Beat Packs", url: "/beat-packs", icon: Music },
    { title: "Collaborate", url: "/collaborate", icon: Zap },
    { title: "Upload", url: "/upload", icon: Upload },
    { title: "Library", url: "/library", icon: Library },
    { title: "Messages", url: "/messages", icon: MessageSquare },
    { title: "Paperwork", url: "/paperwork", icon: FileText },
  ];

  const sharedTools: NavigationItem[] = [
    { title: "Feed Me Beatz", url: "/feed-me-beatz", icon: Music },
    { title: "Notifications", url: "/notifications", icon: Bell },
    { title: "Profile", url: "/profile", icon: UserIcon },
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  const navigation = userRole === 'artist' ? artistNavigation : producerNavigation;

  const isActive = (path: string) => location.pathname === path;
  
  const getNavCls = (path: string) => {
    const baseClasses = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent";
    return isActive(path) 
      ? `${baseClasses} bg-accent text-accent-foreground font-medium`
      : `${baseClasses} text-muted-foreground hover:text-accent-foreground`;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      {/* Remove the internal trigger since we have one in the mobile header */}
      
      <SidebarContent>
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-6">
          {userRole === 'artist' ? (
            <Mic className="h-8 w-8 text-primary" />
          ) : (
            <Headphones className="h-8 w-8 text-primary" />
          )}
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold">BeatPackz</h1>
              <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls(item.url)}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sharedTools.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls(item.url)}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Section */}
        <div className="mt-auto p-4">
          {user ? (
            <div className="space-y-2">
              {!collapsed && (
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{userRole} Account</p>
                </div>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className="w-full justify-start gap-3"
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && "Sign Out"}
              </Button>
            </div>
          ) : (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => navigate("/auth")}
              className="w-full"
            >
              Sign In
            </Button>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}