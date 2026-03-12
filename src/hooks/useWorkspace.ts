import { useState, useCallback } from "react";
import {
  type WorkspaceId,
  WORKSPACES,
  DEFAULT_WORKSPACE,
} from "@/lib/workspaces";

const STORAGE_KEY = "bukzbrain-workspace";

function readStoredWorkspace(): WorkspaceId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in WORKSPACES) return stored as WorkspaceId;
  } catch {
    // localStorage not available
  }
  return DEFAULT_WORKSPACE;
}

export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId>(readStoredWorkspace);

  const switchWorkspace = useCallback((id: WorkspaceId) => {
    setWorkspaceId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage not available
    }
  }, []);

  return {
    workspaceId,
    workspace: WORKSPACES[workspaceId],
    switchWorkspace,
  };
}
