"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Settings, 
  Moon, 
  Sun, 
  Monitor, 
  User, 
  Shield,
  Palette,
  Info
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeProvider";
import { useAuth } from "@/auth/AuthProvider";

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const getUserInitials = (username: string) => {
    return username.charAt(0).toUpperCase();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
      case "annotator":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const getThemeIcon = (themeName: string) => {
    switch (themeName) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      case "system":
        return <Monitor className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and application settings</p>
      </div>

      <div className="grid gap-6">
        {/* User Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your account details and role information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-blue-500 text-white dark:text-blue-50 text-xl">
                  {user ? getUserInitials(user.username) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="text-lg font-medium">{user?.username}</h3>
                <Badge 
                  variant="outline" 
                  className={getRoleColor(user?.role || "")}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Unknown"}
                </Badge>
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Username</Label>
                <p className="text-sm mt-1">{user?.username || "Not available"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                <p className="text-sm mt-1 capitalize">{user?.role || "Not available"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how YOLO Annotator looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="theme">Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger id="theme" className="w-full">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose your preferred theme or let the system decide based on your device settings
              </p>
            </div>

            <Separator />

            {/* Theme Preview */}
            <div className="space-y-3">
              <Label>Theme Preview</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: "Light", value: "light", bgClass: "bg-white", textClass: "text-gray-900" },
                  { name: "Dark", value: "dark", bgClass: "bg-gray-900", textClass: "text-white" },
                  { name: "System", value: "system", bgClass: "bg-gradient-to-r from-white to-gray-900", textClass: "text-gray-600" }
                ].map((themeOption) => (
                  <Button
                    key={themeOption.value}
                    variant={theme === themeOption.value ? "default" : "outline"}
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => setTheme(themeOption.value as typeof theme)}
                  >
                    {getThemeIcon(themeOption.value)}
                    <span className="text-xs">{themeOption.name}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Application Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Application Information
            </CardTitle>
            <CardDescription>
              Details about YOLO Annotator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Application</Label>
                <p className="text-sm mt-1">YOLO Annotator</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Version</Label>
                <p className="text-sm mt-1">1.0.0</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                <p className="text-sm mt-1">{new Date().toLocaleDateString()}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Environment</Label>
                <p className="text-sm mt-1">Production</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;