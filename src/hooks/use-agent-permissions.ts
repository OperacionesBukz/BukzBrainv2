import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildDefaultAgentPermissions,
  buildFullAgentPermissions,
  type AgentPermissions,
  type AgentModuleMap,
} from "@/lib/agent-modules";

export function useAgentPermissions() {
  const { user, isAdmin } = useAuth();
  const [userPerms, setUserPerms] = useState<AgentPermissions | null>(null);
  const [defaultPerms, setDefaultPerms] = useState<AgentPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to user-specific permissions
  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    const unsubUser = onSnapshot(
      doc(db, "navigation_permissions", user.email),
      (snap) => {
        if (snap.exists() && snap.data().agent) {
          setUserPerms(snap.data().agent as AgentPermissions);
        } else {
          setUserPerms(null);
        }
      }
    );

    const unsubDefault = onSnapshot(
      doc(db, "navigation_permissions", "_default"),
      (snap) => {
        if (snap.exists() && snap.data().agent) {
          setDefaultPerms(snap.data().agent as AgentPermissions);
        } else {
          setDefaultPerms(null);
        }
        setLoading(false);
      }
    );

    return () => {
      unsubUser();
      unsubDefault();
    };
  }, [user?.email]);

  // Admins always have full access
  if (isAdmin) {
    return {
      hasAgentAccess: true,
      allowedModules: buildFullAgentPermissions().modules,
      loading: false,
    };
  }

  const effective = userPerms ?? defaultPerms ?? buildDefaultAgentPermissions();

  return {
    hasAgentAccess: effective.enabled,
    allowedModules: effective.modules as AgentModuleMap,
    loading,
  };
}
