import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDQNLHCC3VikYzOq5FfFQ2M6Uc2nz0q6MY",
    authDomain: "bukzbrain-v2-glow-bright.firebaseapp.com",
    projectId: "bukzbrain-v2-glow-bright",
    storageBucket: "bukzbrain-v2-glow-bright.firebasestorage.app",
    messagingSenderId: "968115218436",
    appId: "1:968115218436:web:f0be01c002d1f59ed96d51"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

