"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface ClassDefinition {
  id: number;
  name: string;
  color: string;
  key: string;
}

const COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#eab308", 
  "#a855f7", "#f97316", "#06b6d4", "#84cc16"
];

export const CreateProjectDialog = ({ 
  open, 
  onOpenChange, 
  onCreate 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, classes: ClassDefinition[]) => void;
}) => {
  const [projectName, setProjectName] = useState("");
  const [classes, setClasses] = useState<ClassDefinition[]>([
    { id: 0, name: "person", color: COLORS[0], key: "1" }
  ]);
  const [newClassName, setNewClassName] = useState("");

  const addClass = () => {
    if (newClassName.trim() && classes.length < 9) {
      const newClass: ClassDefinition = {
        id: classes.length,
        name: newClassName.trim(),
        color: COLORS[classes.length % COLORS.length],
        key: (classes.length + 1).toString()
      };
      setClasses([...classes, newClass]);
      setNewClassName("");
    }
  };

  const removeClass = (id: number) => {
    if (classes.length > 1) {
      setClasses(classes.filter(c => c.id !== id));
    }
  };

  const handleCreate = () => {
    if (projectName.trim() && classes.length > 0) {
      onCreate(projectName, classes);
      setProjectName("");
      setClasses([{ id: 0, name: "person", color: COLORS[0], key: "1" }]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
            />
          </div>

          <div>
            <Label>Class Definitions</Label>
            <p className="text-sm text-gray-600 mb-3">
              Define your object classes. Each class will be assigned a color and keyboard shortcut (1-9).
            </p>
            
            <div className="space-y-2 mb-4">
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center space-x-2">
                  <Badge 
                    style={{ backgroundColor: cls.color }} 
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="w-8 text-center font-mono">{cls.key}</span>
                  <Input 
                    value={cls.name} 
                    readOnly 
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeClass(cls.id)}
                    disabled={classes.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {classes.length < 9 && (
              <div className="flex space-x-2">
                <Input
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Add new class"
                  onKeyPress={(e) => e.key === 'Enter' && addClass()}
                />
                <Button onClick={addClass} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Class definitions cannot be changed after project creation. Please review carefully.
            </AlertDescription>
          </Alert>

          <Button onClick={handleCreate} className="w-full" disabled={!projectName || classes.length === 0}>
            Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};