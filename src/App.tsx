import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
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
            <AppLayout>
              <Dashboard />
            </AppLayout>
          } />
          <Route path="/library" element={
            <AppLayout>
              <Library />
            </AppLayout>
          } />
          <Route path="/projects" element={
            <AppLayout>
              <Projects />
            </AppLayout>
          } />
          <Route path="/beat-pack/:id" element={
            <AppLayout>
              <BeatPackPage />
            </AppLayout>
          } />
          <Route path="/explore" element={
            <AppLayout>
              <Explore />
            </AppLayout>
          } />
          <Route path="/upload" element={
            <AppLayout>
              <UploadPage />
            </AppLayout>
          } />
          <Route path="/shared" element={
            <AppLayout>
              <div className="p-6">
                <h1 className="text-2xl font-bold">Shared Projects</h1>
                <p className="text-muted-foreground">Coming soon...</p>
              </div>
            </AppLayout>
          } />
          <Route path="/account" element={
            <AppLayout>
              <Account />
            </AppLayout>
          } />
          <Route path="/settings" element={
            <AppLayout>
              <div className="p-6">
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Coming soon...</p>
              </div>
            </AppLayout>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
