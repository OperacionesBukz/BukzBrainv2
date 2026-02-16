
import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

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
            }

            setUser(user);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
