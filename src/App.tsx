import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { RoleBasedSidebar } from "./components/layout/RoleBasedSidebar";
import { AudioProvider } from "./contexts/AudioContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ArtistDashboard from "./pages/ArtistDashboard";
import ProducerDashboard from "./pages/ProducerDashboard";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import BeatPacks from "./pages/BeatPacks";
import Notifications from "./pages/Notifications";
import Library from "./pages/Library";
import Projects from "./pages/Projects";
import Explore from "./pages/Explore";
import UploadPage from "./pages/Upload";
import BeatPackPage from "./pages/BeatPack";
import AuthPage from "./pages/Auth";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Paperwork from "./pages/Paperwork";
import { SidebarProvider } from "@/components/ui/sidebar";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage />} />
            
            {/* Public beat pack sharing */}
            <Route path="/pack/:id" element={<BeatPackPage />} />
            
            {/* Protected routes with role-based sidebar */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <AudioProvider>
                  <div className="flex min-h-screen w-full">
                    <RoleBasedSidebar />
                    <main className="flex-1 p-6 overflow-auto">
                      <Dashboard />
                    </main>
                  </div>
                </AudioProvider>
              </ProtectedRoute>
            } />
            <Route path="/artist-dashboard" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <ArtistDashboard />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/producer-dashboard" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <ProducerDashboard />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/messages" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 overflow-hidden">
                    <Messages />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Profile />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/beat-packs" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <BeatPacks />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Notifications />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/library" element={
              <ProtectedRoute>
                <AudioProvider>
                  <div className="flex min-h-screen w-full">
                    <RoleBasedSidebar />
                    <main className="flex-1 p-6 overflow-auto">
                      <Library />
                    </main>
                  </div>
                </AudioProvider>
              </ProtectedRoute>
            } />
            <Route path="/projects" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Projects />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/paperwork" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Paperwork />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/explore" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Explore />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/upload" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <UploadPage />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/shared" element={
              <ProtectedRoute>
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
              </ProtectedRoute>
            } />
            <Route path="/account" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <Account />
                  </main>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <div className="flex min-h-screen w-full">
                  <RoleBasedSidebar />
                  <main className="flex-1 p-6 overflow-auto">
                    <div className="space-y-6">
                      <h1 className="text-3xl font-bold">Settings</h1>
                      <p className="text-muted-foreground">Manage your account preferences and privacy settings</p>
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Settings page coming soon...</p>
                      </div>
                    </div>
                  </main>
                </div>
              </ProtectedRoute>
            } />
            
            {/* Catch-all routes */}
            <Route path="/analytics" element={
              <ProtectedRoute>
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
              </ProtectedRoute>
            } />
            <Route path="/financials" element={
              <ProtectedRoute>
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
              </ProtectedRoute>
            } />
            <Route path="/sales" element={
              <ProtectedRoute>
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
              </ProtectedRoute>
            } />
            <Route path="/opportunities" element={
              <ProtectedRoute>
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
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
