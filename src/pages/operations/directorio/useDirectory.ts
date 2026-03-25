import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { DirectoryEntry } from "./types";

export function useDirectory() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "directory"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as DirectoryEntry[];
        setEntries(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error en directory:", error);
        toast.error("Error al sincronizar directorio");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addEntry = async (
    data: Omit<DirectoryEntry, "id" | "createdBy" | "createdAt" | "updatedAt">
  ) => {
    try {
      await addDoc(collection(db, "directory"), {
        ...data,
        createdBy: user?.email || "desconocido",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Registro agregado");
    } catch (error: any) {
      console.error("Error adding directory entry:", error);
      toast.error("Error al agregar registro: " + error.message);
    }
  };

  const updateEntry = async (
    id: string,
    updates: Partial<Omit<DirectoryEntry, "id" | "createdAt" | "createdBy">>
  ) => {
    try {
      await updateDoc(doc(db, "directory", id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error: any) {
      console.error("Error updating directory entry:", error);
      toast.error("Error al actualizar registro");
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, "directory", id));
      toast.success("Registro eliminado");
    } catch (error: any) {
      console.error("Error deleting directory entry:", error);
      toast.error("Error al eliminar registro");
    }
  };

  return { entries, loading, addEntry, updateEntry, deleteEntry };
}
