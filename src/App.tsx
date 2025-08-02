import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { MainLayout } from "./components/layout/MainLayout";
import { ProjectPage } from "./pages/ProjectPage";
import ImagesPage from "./pages/ImagesPage";
import DashboardPage from "./pages/DashboardPage";
import { AnnotationPage } from "./pages/AnnotationPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          } />
          <Route path="/images" element={
            <MainLayout>
              <ImagesPage />
            </MainLayout>
          } />
          <Route path="/annotate/:imageId" element={
            <AnnotationPage />
          } />
          <Route path="/project/:id" element={
            <MainLayout>
              <ProjectPage />
            </MainLayout>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;