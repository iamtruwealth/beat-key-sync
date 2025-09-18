import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import Projects from "./pages/Projects";
import Explore from "./pages/Explore";
import UploadPage from "./pages/Upload";
import BeatPackPage from "./pages/BeatPack";
import AuthPage from "./pages/Auth";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<AuthPage />} />
          
          {/* Protected routes with layout */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/library" element={
            <ProtectedRoute>
              <AppLayout>
                <Library />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/projects" element={
            <ProtectedRoute>
              <AppLayout>
                <Projects />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/beat-pack/:id" element={
            <ProtectedRoute>
              <AppLayout>
                <BeatPackPage />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/explore" element={
            <ProtectedRoute>
              <AppLayout>
                <Explore />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/upload" element={
            <ProtectedRoute>
              <AppLayout>
                <UploadPage />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/shared" element={
            <ProtectedRoute>
              <AppLayout>
                <div className="p-6">
                  <h1 className="text-2xl font-bold">Shared Projects</h1>
                  <p className="text-muted-foreground">Coming soon...</p>
                </div>
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/account" element={
            <ProtectedRoute>
              <AppLayout>
                <Account />
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <AppLayout>
                <div className="p-6">
                  <h1 className="text-2xl font-bold">Settings</h1>
                  <p className="text-muted-foreground">Coming soon...</p>
                </div>
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
