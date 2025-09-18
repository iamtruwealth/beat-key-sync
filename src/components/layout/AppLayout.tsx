import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MusicPlayer } from "../MusicPlayer";
import { Menu } from "lucide-react";
import { AudioProvider } from "@/contexts/AudioContext";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <AudioProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          
          <div className="flex-1 flex flex-col">
            {/* Top Header */}
            <header className="h-16 flex items-center justify-between px-4 border-b border-border bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="lg:hidden">
                  <Menu className="w-5 h-5" />
                </SidebarTrigger>
                <h1 className="text-xl font-semibold text-foreground">
                  Music Producer Platform
                </h1>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Future: User avatar, notifications, etc. */}
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30"></div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-auto pb-24">
              {children}
            </main>
          </div>
          
          {/* Music Player */}
          <MusicPlayer />
        </div>
      </SidebarProvider>
    </AudioProvider>
  );
}