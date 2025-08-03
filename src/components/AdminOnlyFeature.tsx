import { ReactNode } from "react";
import { useRoles } from "@/auth/useRoles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

interface AdminOnlyFeatureProps {
  children: ReactNode;
  fallback?: ReactNode;
  showMessage?: boolean;
}

export const AdminOnlyFeature = ({ 
  children, 
  fallback, 
  showMessage = true 
}: AdminOnlyFeatureProps) => {
  const { isAdmin } = useRoles();

  if (!isAdmin) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (showMessage) {
      return (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            This feature is only available to administrators.
          </AlertDescription>
        </Alert>
      );
    }
    
    return null;
  }

  return <>{children}</>;
};