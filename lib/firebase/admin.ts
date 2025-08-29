import { initializeApp, getApps } from "firebase-admin/app"
import { getStorage } from "firebase-admin/storage"
import { getFirestore } from "firebase-admin/firestore"

let adminApp: any = null
let adminStorage: any = null
let adminFirestore: any = null

try {
  if (!getApps().length) {
    // 간단한 초기화 방식 사용 (서비스 계정 키 없이)
    adminApp = initializeApp({
      projectId: "dyhs-file-link",
      storageBucket: "dyhs-file-link.firebasestorage.app",
    })
  } else {
    adminApp = getApps()[0]
  }

  adminStorage = getStorage(adminApp)
  adminFirestore = getFirestore(adminApp)
} catch (error) {
  console.error("Firebase Admin SDK initialization failed:", error)
  // Fallback: null 값으로 설정하여 업로드 API에서 처리
  adminStorage = null
  adminFirestore = null
}

export { adminStorage, adminFirestore }
