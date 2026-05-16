import { initializeApp } from 'firebase/app';
import {
    getAuth,
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    type User,
} from 'firebase/auth';

const firebaseConfig = {
    apiKey: 'AIzaSyC0_0uwfPzcjj_aKUoGCZdZBx8gqZXBYTs',
    authDomain: 'ai-dashbords.firebaseapp.com',
    projectId: 'ai-dashbords',
    storageBucket: 'ai-dashbords.firebasestorage.app',
    messagingSenderId: '662418780933',
    appId: '1:662418780933:web:5e55c8faf643b8f7d7bd6c',
    measurementId: 'G-VLNCQT8KG3',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    type User,
};
