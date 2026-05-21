import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    auth,
    onAuthStateChanged,
    signOut,
    signInWithPopup,
    googleProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    type User,
} from '../lib/firebase';

export interface DbUser {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    currentRole: string | null;
    yearsOfExperience: number | null;
    targetRole: string | null;
    education: string | null;
    linkedinUrl: string | null;
    skills: string[];
    profileCompleted: boolean;
    createdAt: string;
}

interface AuthContextType {
    user: User | null;
    dbUser: DbUser | null;
    loading: boolean;        // Firebase auth resolving
    dbUserLoading: boolean;  // DB profile fetch in progress
    signInWithGoogle: () => Promise<void>;
    signInEmail: (email: string, password: string) => Promise<void>;
    signUpEmail: (email: string, password: string, name: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshDbUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [dbUserLoading, setDbUserLoading] = useState(false);

    const fetchDbUser = async (firebaseUser: User) => {
        setDbUserLoading(true);
        try {
            const token = await firebaseUser.getIdToken();
            const res = await fetch('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setDbUser(data as DbUser);
            }
        } catch (e) {
            console.warn('Could not fetch DB user profile:', e);
        } finally {
            setDbUserLoading(false);
        }
    };

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                await fetchDbUser(u);
            } else {
                setDbUser(null);
                setDbUserLoading(false);
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    const refreshDbUser = async () => {
        if (user) await fetchDbUser(user);
    };

    const signInWithGoogle = async () => {
        // onAuthStateChanged will handle setUser + fetchDbUser
        await signInWithPopup(auth, googleProvider);
    };

    const signInEmail = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signUpEmail = async (email: string, password: string, name: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        // Do NOT setUser here — let onAuthStateChanged handle it so
        // fetchDbUser runs before routing decisions are made.
    };

    const logout = async () => {
        await signOut(auth);
        setDbUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user, dbUser, loading, dbUserLoading,
            signInWithGoogle, signInEmail, signUpEmail, logout, refreshDbUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}

/** Retrieves a fresh Firebase ID token for the current user. Returns null if not signed in. */
export async function getIdToken(): Promise<string | null> {
    const { currentUser } = await import('../lib/firebase').then(m => ({ currentUser: m.auth.currentUser }));
    if (!currentUser) return null;
    return currentUser.getIdToken();
}
