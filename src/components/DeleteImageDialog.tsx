"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface DeleteImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageName: string;
  onConfirm: () => void;
}

export const DeleteImageDialog = ({ 
  open, 
  onOpenChange, 
  imageName, 
  onConfirm 
}: DeleteImageDialogProps) => {
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
            Delete Image
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>"{imageName}"</strong>?
            <br />
            <br />
            This action will permanently remove:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>The uploaded image file</li>
              <li>All annotations and labels for this image</li>
              <li>Any associated metadata</li>
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
            Delete Image
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};