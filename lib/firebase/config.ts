import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyB-EzYhslE7hEspIR3vQxziP2K1nWIo1y0",
  authDomain: "dyhs-file-link.firebaseapp.com",
  projectId: "dyhs-file-link",
  storageBucket: "dyhs-file-link.firebasestorage.app",
  messagingSenderId: "989175371143",
  appId: "1:989175371143:web:1b94aef2c22307af016f22",
  measurementId: "G-97TQMBRF3P",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
