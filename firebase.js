import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  runTransaction,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBA8ycGuk0FBDDh5jBb1Kln_uiN5khNsic",
  authDomain: "partyhub-ba01d.firebaseapp.com",
  projectId: "partyhub-ba01d",
  storageBucket: "partyhub-ba01d.firebasestorage.app",
  messagingSenderId: "593126711",
  appId: "1:593126711:web:67274ce6a5dc9dabf6e6b2"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

export {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  runTransaction,
  deleteDoc
};