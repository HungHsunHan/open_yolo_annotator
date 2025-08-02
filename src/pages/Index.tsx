import { ProjectsPage } from "./ProjectsPage";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { MainLayout } from "@/components/layout/MainLayout";

const Index = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">YOLO Annotation Tool</h1>
          <p className="text-lg text-gray-600">
            Create and manage your YOLO object detection datasets
          </p>
        </div>
        
        <ProjectsPage />
        
        <div className="mt-12">
          <MadeWithDyad />
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;