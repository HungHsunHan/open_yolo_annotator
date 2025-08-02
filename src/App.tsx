import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
// import { AuthProvider } from "./auth/AuthProvider";
import { MainLayout } from "./components/layout/MainLayout";
import { ProjectPage } from "./pages/ProjectPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ImagesPage } from "./pages/ImagesPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* <AuthProvider> */}
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/projects" element={
              <MainLayout>
                <ProjectsPage />
              </MainLayout>
            } />
            <Route path="/images" element={
              <MainLayout>
                <ImagesPage />
              </MainLayout>
            } />
            <Route path="/project/:id" element={
              <MainLayout>
                <ProjectPage />
              </MainLayout>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      {/* </AuthProvider> */}
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;