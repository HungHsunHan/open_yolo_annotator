"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ClassManagerProps {
  projectClasses?: string[];
}

const COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#eab308", 
  "#a855f7", "#f97316", "#06b6d4", "#84cc16"
];

export const ClassManager = ({ projectClasses = ["object"] }: ClassManagerProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Class Management</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-60">
          <div className="space-y-2">
            {projectClasses.map((className, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-2 bg-gray-100 rounded"
              >
                <div className="flex items-center">
                  <Badge 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                    className="w-8 h-8 rounded-full mr-2"
                  />
                  <span className="font-mono w-8 text-center bg-gray-200 rounded mr-2">
                    {index}
                  </span>
                  <span>{className}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-4 text-sm text-gray-500">
          <p>Total classes: {projectClasses.length}</p>
          <p className="text-xs mt-1">Classes are defined during project creation</p>
        </div>
      </CardContent>
    </Card>
  );
};