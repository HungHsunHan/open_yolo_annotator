"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface ClearAllImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageCount: number;
  projectName: string;
  onConfirm: () => void;
}

export const ClearAllImagesDialog = ({ 
  open, 
  onOpenChange, 
  imageCount, 
  projectName,
  onConfirm 
}: ClearAllImagesDialogProps) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Clear All Images
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to clear all <strong>{imageCount} images</strong> from project <strong>"{projectName}"</strong>?
            <br />
            <br />
            This action will permanently remove:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>All {imageCount} uploaded image files</li>
              <li>All annotations and labels for these images</li>
              <li>All associated metadata and progress</li>
            </ul>
            <br />
            <span className="text-red-600 font-medium">This action cannot be undone.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            Clear All Images
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};