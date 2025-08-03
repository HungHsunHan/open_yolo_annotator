"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onConfirm: () => void;
}

export const DeleteProjectDialog = ({ 
  open, 
  onOpenChange, 
  projectName, 
  onConfirm 
}: DeleteProjectDialogProps) => {
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
            Delete Project
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the project <strong>"{projectName}"</strong>?
            <br />
            <br />
            This action will permanently remove:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>All uploaded images</li>
              <li>All annotations and labels</li>
              <li>Project configuration and settings</li>
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
            Delete Project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};