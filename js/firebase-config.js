import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbWUnP1jjdVGenDJq3MKL9767x5VyQqeA",
  authDomain: "fit-6b3a7.firebaseapp.com",
  projectId: "fit-6b3a7",
  storageBucket: "fit-6b3a7.firebasestorage.app",
  messagingSenderId: "193549143717",
  appId: "1:193549143717:web:84b37c62223b19fe8b074c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
