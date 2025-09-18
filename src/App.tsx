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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/library" element={<Library />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/beat-pack/:id" element={<BeatPackPage />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/shared" element={<div className="p-6"><h1 className="text-2xl font-bold">Shared Projects</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
            <Route path="/account" element={<Account />} />
            <Route path="/settings" element={<div className="p-6"><h1 className="text-2xl font-bold">Settings</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
