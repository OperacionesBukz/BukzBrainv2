import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type NotificationType =
  | "task_assigned"
  | "leave_request_approved"
  | "leave_request_rejected"
  | "leave_request_created";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  resourcePath: string;
  createdAt: Timestamp | null;
}

export async function createNotification(
  data: Omit<Notification, "id" | "read" | "createdAt">
): Promise<void> {
  await addDoc(collection(db, "notifications"), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

export async function markAllNotificationsAsRead(
  userId: string
): Promise<void> {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("read", "==", false)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}

const SUPER_ADMIN_EMAIL = "operaciones@bukz.co";

export async function createNotificationForAdmins(
  data: Omit<Notification, "id" | "read" | "createdAt" | "userId">
): Promise<void> {
  const adminsSnap = await getDocs(
    query(collection(db, "users"), where("role", "==", "admin"))
  );
  const adminEmails = new Set<string>();
  adminsSnap.docs.forEach((d) => {
    const email = d.data().email as string | undefined;
    if (email) adminEmails.add(email);
  });
  adminEmails.add(SUPER_ADMIN_EMAIL);

  const promises = Array.from(adminEmails).map((email) =>
    createNotification({ ...data, userId: email })
  );
  await Promise.allSettled(promises);
}
