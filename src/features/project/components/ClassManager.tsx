"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus } from "lucide-react";

interface ClassItem {
  id: number;
  name: string;
}

export const ClassManager = () => {
  const [classes, setClasses] = useState<ClassItem[]>([
    { id: 0, name: "object" }
  ]);
  const [newClassName, setNewClassName] = useState("");

  const addClass = () => {
    if (newClassName.trim() && !classes.some(c => c.name === newClassName.trim())) {
      const newId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 0;
      setClasses([...classes, { id: newId, name: newClassName.trim() }]);
      setNewClassName("");
    }
  };

  const removeClass = (id: number) => {
    setClasses(classes.filter(c => c.id !== id));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addClass();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Class Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Add new class"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Button onClick={addClass} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <ScrollArea className="h-60">
          <div className="space-y-2">
            {classes.map((cls) => (
              <div 
                key={cls.id} 
                className="flex items-center justify-between p-2 bg-gray-100 rounded"
              >
                <div className="flex items-center">
                  <span className="font-mono w-8 text-center bg-gray-200 rounded mr-2">
                    {cls.id}
                  </span>
                  <span>{cls.name}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => removeClass(cls.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-4 text-sm text-gray-500">
          <p>Total classes: {classes.length}</p>
        </div>
      </CardContent>
    </Card>
  );
};