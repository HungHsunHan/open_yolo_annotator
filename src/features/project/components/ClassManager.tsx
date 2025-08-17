"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ClassDefinition } from "../types";

interface ClassManagerProps {
  projectClasses?: string[];
  classDefinitions?: ClassDefinition[];
}

const COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#eab308", 
  "#a855f7", "#f97316", "#06b6d4", "#84cc16"
];

export const ClassManager = ({ projectClasses = ["object"], classDefinitions }: ClassManagerProps) => {
  // Use classDefinitions if available, otherwise fallback to projectClasses with default colors
  const classes = classDefinitions || projectClasses.map((name, index) => ({
    id: index,
    name,
    color: COLORS[index % COLORS.length],
    key: (index + 1).toString()
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Class Management</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-60">
          <div className="space-y-2">
            {classes.map((cls, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-2 rounded"
                style={{ backgroundColor: cls.color }}
              >
                <div className="flex items-center">
                  <Badge 
                    style={{ backgroundColor: cls.color }} 
                    className="w-8 h-8 rounded-full mr-2 font-bold flex items-center justify-center text-black border-2 border-black"
                  >
                    {cls.key}
                  </Badge>
                  <span className="font-medium text-black">{cls.name}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-4 text-sm text-gray-500">
          <p>Total classes: {classes.length}</p>
          <p className="text-xs mt-1">Classes are defined during project creation</p>
        </div>
      </CardContent>
    </Card>
  );
};