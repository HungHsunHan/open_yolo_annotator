import { ProjectsPage } from "./ProjectsPage";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
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
    </div>
  );
};

export default Index;