// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAhC6qhVFT3SuUs1hhwei9fjZSOvWOy_do",
    authDomain: "gustavo-fdc46.firebaseapp.com",
    projectId: "gustavo-fdc46",
    storageBucket: "gustavo-fdc46.firebasestorage.app",
    messagingSenderId: "204278836918",
    appId: "1:204278836918:web:4184b03e0efbb9cda38017",
    measurementId: "G-30VJFRHGRT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
