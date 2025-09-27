import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { RoleBasedSidebar } from "./components/layout/RoleBasedSidebar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AudioProvider } from "./contexts/AudioContext";
import { Menu } from "lucide-react";
import { CartProvider } from "./contexts/CartContext";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ArtistDashboard from "./pages/ArtistDashboard";
import ProducerDashboard from "./pages/ProducerDashboard";
import UploadStems from "./pages/UploadStems";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import BeatPacks from "./pages/BeatPacks";
import Notifications from "./pages/Notifications";
import Library from "./pages/Library";
import Projects from "./pages/Projects";
import BrowseProducers from "./pages/BrowseProducers";
import UploadPage from "./pages/Upload";
import BeatPackPage from "./pages/BeatPack";
import AuthPage from "./pages/Auth";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import Feed from "./pages/Feed";
import FeedMeBeatz from "./pages/FeedMeBeatz";
import Terms from "./pages/Terms";
import Paperwork from "./pages/Paperwork";
import SettingsPage from "./pages/Settings";
import NewExplore from "./pages/NewExplore";
import ProducerProfile from "./pages/ProducerProfile";
import UserProfile from "./pages/UserProfile";
import Onboarding from "./pages/Onboarding";
import Collaborate from "./pages/Collaborate";
import CookMode from "./pages/CookMode";

import { FuturisticWaveformPlayer } from "./components/player/FuturisticWaveformPlayer";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SidebarProvider>
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/about" element={<About />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/auth" element={<AuthPage />} />
            
            {/* Public feed pages */}
            <Route path="/feed" element={
              <AudioProvider>
                <>
                  <Feed />
                  <FuturisticWaveformPlayer />
                </>
              </AudioProvider>
            } />
            <Route path="/feed-me-beatz" element={
              <AudioProvider>
                <FeedMeBeatz />
              </AudioProvider>
            } />
            
            {/* Public explore page */}
            <Route path="/explore" element={
              <AudioProvider>
                <>
                  <NewExplore />
                  <FuturisticWaveformPlayer />
                </>
              </AudioProvider>
            } />
            
            
            {/* Public beat pack sharing */}
            <Route path="/pack/:id" element={
              <AudioProvider>
                <>
                  <BeatPackPage />
                  <FuturisticWaveformPlayer />
                </>
              </AudioProvider>
            } />
            
            {/* Public browse producers page */}
            <Route path="/browse-producers" element={
              <AudioProvider>
                <BrowseProducers />
              </AudioProvider>
            } />
            
            <Route path="/beat-pack/:id" element={
              <AudioProvider>
                <>
                  <BeatPackPage />
                  <FuturisticWaveformPlayer />
                </>
              </AudioProvider>
            } />
            
            {/* Protected routes with role-based sidebar */}
            <Route path="/dashboard" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <AudioProvider>
                  <div className="flex min-h-screen w-full">
                    <RoleBasedSidebar />
                    <main className="flex-1 p-6 overflow-auto">
                      <Dashboard />
                    </main>
                  </div>
                </AudioProvider>
              </RoleProtectedRoute>
            } />
            <Route path="/artist-dashboard" element={
              <RoleProtectedRoute allowedRoles={['artist']}>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <RoleBasedSidebar />
                    <div className="flex-1 flex flex-col">
                      {/* Mobile header with sidebar trigger */}
                      <header className="h-16 flex items-center justify-between px-4 border-b border-border bg-card/50 backdrop-blur-sm lg:hidden">
                        <SidebarTrigger>
                          <Menu className="w-5 h-5" />
                        </SidebarTrigger>
                        <h1 className="text-lg font-semibold">Artist Dashboard</h1>
                        <div></div>
                      </header>
                      <main className="flex-1 p-6 overflow-auto">
                        <ArtistDashboard />
                      </main>
                    </div>
                  </div>
                </SidebarProvider>
              </RoleProtectedRoute>
            } />
            <Route path="/producer-dashboard" element={
              <RoleProtectedRoute allowedRoles={['producer']}>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <RoleBasedSidebar />
                    <div className="flex-1 flex flex-col">
                      {/* Mobile header with sidebar trigger */}
                      <header className="h-16 flex items-center justify-between px-4 border-b border-border bg-card/50 backdrop-blur-sm lg:hidden">
                        <SidebarTrigger>
                          <Menu className="w-5 h-5" />
                        </SidebarTrigger>
                        <h1 className="text-lg font-semibold">Producer Dashboard</h1>
                        <div></div>
                      </header>
                      <main className="flex-1 p-6 overflow-auto">
                        <ProducerDashboard />
                      </main>
                    </div>
                  </div>
                </SidebarProvider>
              </RoleProtectedRoute>
            } />
            <Route path="/messages" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 overflow-hidden">
                    <Messages />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/profile" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Profile />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/beat-packs" element={
              <RoleProtectedRoute allowedRoles={['producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <BeatPacks />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/notifications" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Notifications />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/library" element={
              <RoleProtectedRoute allowedRoles={['producer']}>
                <AudioProvider>
                  <div className="flex min-h-screen w-full">
                    <RoleBasedSidebar />
                    <main className="flex-1 p-6 overflow-auto">
                      <Library />
                    </main>
                  </div>
                </AudioProvider>
              </RoleProtectedRoute>
            } />
            <Route path="/projects" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Projects />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/paperwork" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Paperwork />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/browse" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <BrowseProducers />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/upload" element={
              <RoleProtectedRoute allowedRoles={['producer']}>
                <AudioProvider>
                  <div className="flex min-h-screen w-full">
                    <RoleBasedSidebar />
                    <main className="flex-1 p-6 overflow-auto">
                      <UploadPage />
                    </main>
                  </div>
                </AudioProvider>
              </RoleProtectedRoute>
            } />
            <Route path="/upload-stems" element={
              <RoleProtectedRoute allowedRoles={['producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 overflow-auto">
                    <UploadStems />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/shared" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <div className="space-y-6">
                      <h1 className="text-3xl font-bold">Shared Projects</h1>
                      <p className="text-muted-foreground">Collaborate on projects with other artists and producers</p>
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Shared collaboration features coming soon...</p>
                      </div>
                    </div>
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/account" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Account />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/settings" element={
              <RoleProtectedRoute allowedRoles={['producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <SettingsPage />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/collaborate" element={
              <RoleProtectedRoute allowedRoles={['producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 overflow-auto">
                    <Collaborate />
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/cook-mode" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <CookMode />
              </RoleProtectedRoute>
            } />
            <Route path="/cook-mode/:sessionId" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <CookMode />
              </RoleProtectedRoute>
            } />
            
            {/* Catch-all routes */}
            <Route path="/analytics" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <div className="space-y-6">
                      <h1 className="text-3xl font-bold">Analytics</h1>
                      <p className="text-muted-foreground">Track your music performance and engagement</p>
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Analytics dashboard coming soon...</p>
                      </div>
                    </div>
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/financials" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <div className="space-y-6">
                      <h1 className="text-3xl font-bold">Financials</h1>
                      <p className="text-muted-foreground">Manage your earnings, royalties, and payments</p>
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Financial dashboard coming soon...</p>
                      </div>
                    </div>
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/sales" element={
              <RoleProtectedRoute allowedRoles={['producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <div className="space-y-6">
                      <h1 className="text-3xl font-bold">Sales</h1>
                      <p className="text-muted-foreground">Track your beat pack sales and revenue</p>
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Sales dashboard coming soon...</p>
                      </div>
                    </div>
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            <Route path="/opportunities" element={
              <RoleProtectedRoute allowedRoles={['artist', 'producer']}>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <div className="space-y-6">
                      <h1 className="text-3xl font-bold">Opportunities</h1>
                      <p className="text-muted-foreground">Discover collaboration opportunities and networking</p>
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Opportunities marketplace coming soon...</p>
                      </div>
                    </div>
                  </main>
                </div>
              </RoleProtectedRoute>
            } />
            
            {/* Username-based profile route - must be last to avoid conflicts */}
            <Route path="/:username" element={
              <AudioProvider>
                <UserProfile />
              </AudioProvider>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          </SidebarProvider>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
