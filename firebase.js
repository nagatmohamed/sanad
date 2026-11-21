// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

// Firebase Project Configuration
const firebaseConfig = {
    apiKey: "AIzaSyC03G2-ev85z-w-ZLgkoCU9LApphXjUTY",
    authDomain: "sanad-9f9db.firebaseapp.com",
    databaseURL: "https://sanad-9f9db-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "sanad-9f9db",
    storageBucket: "sanad-9f9db.firebasestorage.app",
    messagingSenderId: "1043550075297",
    appId: "1:1043550075297:web:62c08c3e3f2d072f7e33e0",
    measurementId: "G-381VHG46ZH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication
const auth = getAuth(app);

// Initialize Database
const db = getDatabase(app);

// Export Firebase services
export { app, auth, db };