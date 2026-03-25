import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShieldCheck, Settings2 } from "lucide-react";
import { usePermissionsData } from "./usePermissionsData";
import { UsersTab } from "./UsersTab";
import { PermissionsTab } from "./PermissionsTab";
import { DefaultConfigTab } from "./DefaultConfigTab";
import type { PermissionTemplate } from "./permission-templates";

export default function UserManagement() {
  const { user, isAdmin, roleLoading } = useAuth();
  const navigate = useNavigate();

  const {
    defaultPages,
    defaultWorkspaces,
    defaultAgent,
    registeredUsers,
    displayUsers,
    saving,
    toggleDefaultPage,
    toggleDefaultWorkspace,
    toggleDefaultAgentEnabled,
    toggleDefaultAgentModule,
    saveUserConfig,
    toggleUserPage,
    toggleUserWorkspace,
    toggleUserAgentEnabled,
    toggleUserAgentModule,
    resetToDefault,
  } = usePermissionsData();

  // Access guard
  useEffect(() => {
    if (user && !roleLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [user, roleLoading, isAdmin, navigate]);

  const handleApplyTemplate = useCallback(
    async (email: string, template: PermissionTemplate) => {
      await saveUserConfig(email, template.pages, template.workspaces);
      if (template.agent) {
        await toggleUserAgentEnabled(email, template.agent.enabled);
        // Also set module permissions from template
        for (const [moduleId, value] of Object.entries(template.agent.modules)) {
          await toggleUserAgentModule(email, moduleId, value);
        }
      }
    },
    [saveUserConfig, toggleUserAgentEnabled, toggleUserAgentModule]
  );

  if (!user || roleLoading || !isAdmin) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Users className="h-5 w-5 text-black dark:text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Gestion de Usuarios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra usuarios, permisos de navegacion y configuracion por
            defecto.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Usuarios</span>
          </TabsTrigger>
          <TabsTrigger value="permisos" className="gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Permisos</span>
          </TabsTrigger>
          <TabsTrigger value="config-default" className="gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Config Default</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <UsersTab users={registeredUsers} />
        </TabsContent>

        <TabsContent value="permisos" className="mt-4">
          <PermissionsTab
            displayUsers={displayUsers}
            defaultPages={defaultPages}
            defaultWorkspaces={defaultWorkspaces}
            defaultAgent={defaultAgent}
            saving={saving}
            onTogglePage={toggleUserPage}
            onToggleWorkspace={toggleUserWorkspace}
            onToggleAgentEnabled={toggleUserAgentEnabled}
            onToggleAgentModule={toggleUserAgentModule}
            onApplyTemplate={handleApplyTemplate}
            onResetToDefault={resetToDefault}
          />
        </TabsContent>

        <TabsContent value="config-default" className="mt-4">
          <DefaultConfigTab
            defaultPages={defaultPages}
            defaultWorkspaces={defaultWorkspaces}
            defaultAgent={defaultAgent}
            saving={saving}
            onTogglePage={toggleDefaultPage}
            onToggleWorkspace={toggleDefaultWorkspace}
            onToggleAgentEnabled={toggleDefaultAgentEnabled}
            onToggleAgentModule={toggleDefaultAgentModule}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
