
import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    role: string | null;
    roleLoading: boolean;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    role: null,
    roleLoading: true,
    isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check if session is expired (30 days)
                const lastLoginKey = `last_login_${user.uid}`;
                const lastLogin = localStorage.getItem(lastLoginKey);
                const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
                const now = Date.now();

                if (lastLogin) {
                    const timeDiff = now - parseInt(lastLogin);
                    if (timeDiff > thirtyDaysInMs) {
                        try {
                            await auth.signOut();
                            localStorage.removeItem(lastLoginKey);
                            setUser(null);
                            setRole(null);
                            setRoleLoading(false);
                            setLoading(false);
                            return; // Stop execution
                        } catch (error) {
                            console.error("Error signing out expired session:", error);
                        }
                    }
                } else {
                    // First login set time
                    localStorage.setItem(lastLoginKey, now.toString());
                }

                // Register user in Firestore so admin can see them
                if (user.email) {
                    setDoc(
                        doc(db, "users", user.email),
                        {
                            email: user.email,
                            displayName: user.displayName || user.email.split("@")[0],
                            lastLogin: serverTimestamp(),
                            uid: user.uid,
                        },
                        { merge: true }
                    ).catch(() => {/* silent */});
                }
            } else {
                setRole(null);
                setRoleLoading(false);
            }

            setUser(user);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    // Listen to user's role from Firestore in real-time
    useEffect(() => {
        if (!user?.email) {
            setRole(null);
            setRoleLoading(false);
            return;
        }

        setRoleLoading(true);
        const unsub = onSnapshot(
            doc(db, "users", user.email),
            (snap) => {
                if (snap.exists()) {
                    setRole(snap.data()?.role || null);
                } else {
                    setRole(null);
                }
                setRoleLoading(false);
            },
            (error) => {
                console.error("Error listening to user role:", error);
                setRole(null);
                setRoleLoading(false);
            }
        );

        return () => unsub();
    }, [user?.email]);

    const isAdmin = role === "admin";

    return (
        <AuthContext.Provider value={{ user, loading, role, roleLoading, isAdmin }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
