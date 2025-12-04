import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyB-EzYhslE7hEspIR3vQxziP2K1nWIo1y0",
  authDomain: "dyhs-file-link.firebaseapp.com",
  projectId: "dyhs-file-link",
  storageBucket: "dyhs-file-link.firebasestorage.app",
  messagingSenderId: "989175371143",
  appId: "1:989175371143:web:1b94aef2c22307af016f22",
  measurementId: "G-97TQMBRF3P",
}

let app: FirebaseApp | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null
let initAttempted = false

function initializeFirebase() {
  if (initAttempted) return
  initAttempted = true

  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
    db = getFirestore(app)
    storage = getStorage(app)
    console.log("[v0] Firebase initialized successfully")
  } catch (error) {
    console.warn("[v0] Firebase initialization failed, using localStorage fallback:", error)
    app = null
    db = null
    storage = null
  }
}

// 지연 초기화를 위한 getter 함수들
export function getDb(): Firestore | null {
  if (!initAttempted) initializeFirebase()
  return db
}

export function getStorageInstance(): FirebaseStorage | null {
  if (!initAttempted) initializeFirebase()
  return storage
}

export function getApp2(): FirebaseApp | null {
  if (!initAttempted) initializeFirebase()
  return app
}

// 기존 코드와의 호환성을 위해 export (null일 수 있음)
export { db, storage }
export default app
