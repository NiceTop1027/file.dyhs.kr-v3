import { getDb, getStorageInstance } from "@/lib/firebase/config"
import { collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore"
import { ref, deleteObject } from "firebase/storage"

export interface FileMetadata {
  id: string
  filename: string
  originalName: string
  size: number
  type: string
  url: string
  uploadedAt: string
  downloadCount: number
  userId: string
  securityMode?: boolean
  expiresAt?: string
  passwordProtected?: boolean
  password?: string
  encrypted?: boolean
}

// 간단한 ID 생성 함수
export function generateFileId(): string {
  return generateSecureFileId()
}

function isFirebaseAvailable(): boolean {
  try {
    const db = getDb()
    return db !== null
  } catch {
    return false
  }
}

export async function saveFileMetadata(metadata: FileMetadata): Promise<void> {
  if (!isFirebaseAvailable()) {
    console.log("[v0] Firebase not available, using localStorage")
    saveFileMetadataLocal({
      ...metadata,
      expiresAt: metadata.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    return
  }

  try {
    const db = getDb()!
    const expiresAt = metadata.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const fileRef = doc(db, "files", metadata.id)

    const dataToSave: any = {
      id: metadata.id,
      filename: metadata.filename,
      originalName: metadata.originalName,
      size: metadata.size,
      type: metadata.type,
      url: metadata.url,
      uploadedAt: metadata.uploadedAt,
      downloadCount: metadata.downloadCount,
      userId: metadata.userId,
      securityMode: metadata.securityMode || false,
      expiresAt: expiresAt,
      passwordProtected: metadata.passwordProtected || false,
    }

    // 비밀번호가 있는 경우 해싱 후 저장
    if (metadata.password !== undefined && metadata.password) {
      // 이미 해시된 비밀번호인지 확인 (평문 레거시 지원)
      if (!metadata.password.startsWith('$2')) {
        const { hashPassword } = await import('@/lib/password')
        dataToSave.password = await hashPassword(metadata.password)
      } else {
        dataToSave.password = metadata.password
      }
    }

    await setDoc(fileRef, dataToSave)
    console.log("[v0] Successfully saved file to Firebase:", metadata.id, "expires at:", expiresAt)
  } catch (error) {
    console.error("Failed to save to Firebase:", error)
    saveFileMetadataLocal({
      ...metadata,
      expiresAt: metadata.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
  }
}

export async function getStoredFiles(): Promise<FileMetadata[]> {
  if (!isFirebaseAvailable()) {
    console.log("[v0] Firebase not available, using localStorage")
    return getFileMetadataLocal()
  }

  try {
    console.log("[v0] Attempting to fetch files from Firebase...")
    const db = getDb()!
    const currentUserId = getUserSessionId()
    console.log("[v0] Current user ID:", currentUserId)

    const filesRef = collection(db, "files")
    const q = query(filesRef, where("userId", "==", currentUserId))

    const querySnapshot = await getDocs(q)
    const files: FileMetadata[] = []
    const now = new Date()

    querySnapshot.forEach((doc) => {
      const data = doc.data()

      if (data.expiresAt && new Date(data.expiresAt) < now) {
        console.log("[v0] File expired, deleting:", data.id)
        deleteFileMetadata(data.id).catch(console.error)
        return // 만료된 파일은 목록에 포함하지 않음
      }

      files.push({
        id: data.id,
        filename: data.filename,
        originalName: data.originalName,
        size: data.size,
        type: data.type,
        url: data.url,
        uploadedAt: data.uploadedAt,
        downloadCount: data.downloadCount,
        userId: data.userId,
        securityMode: data.securityMode,
        expiresAt: data.expiresAt,
        passwordProtected: data.passwordProtected,
        password: data.password,
      })
    })

    files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

    console.log("[v0] Successfully fetched", files.length, "files from Firebase")
    return files
  } catch (error) {
    console.error("[v0] Firebase connection failed:", error)
    console.error("[v0] Error type:", typeof error)
    console.error("[v0] Error name:", error instanceof Error ? error.name : "Unknown")
    console.error("[v0] Error message:", error instanceof Error ? error.message : String(error))
    console.warn("[v0] Falling back to local storage")
    return getFileMetadataLocal()
  }
}

export function getAllStoredFilesLocal(): FileMetadata[] {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("uploadedFiles")
    return stored ? JSON.parse(stored) : []
  }
  return []
}

function getFileMetadataLocal(): FileMetadata[] {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("uploadedFiles")
    const allFiles = stored ? JSON.parse(stored) : []
    const currentUserId = getUserSessionId()
    return allFiles.filter((file: FileMetadata) => file.userId === currentUserId)
  }
  return []
}

export function getUserSessionId(): string {
  if (typeof window !== "undefined") {
    let userId = localStorage.getItem("userSessionId")
    if (!userId) {
      userId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      localStorage.setItem("userSessionId", userId)
    }
    return userId
  }
  return ""
}

export async function getAllStoredFiles(): Promise<FileMetadata[]> {
  try {
    const db = getDb()!
    const filesRef = collection(db, "files")
    const querySnapshot = await getDocs(filesRef)

    const files: FileMetadata[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      files.push({
        id: data.id,
        filename: data.filename,
        originalName: data.originalName,
        size: data.size,
        type: data.type,
        url: data.url,
        uploadedAt: data.uploadedAt,
        downloadCount: data.downloadCount,
        userId: data.userId,
        securityMode: data.securityMode,
        expiresAt: data.expiresAt,
        passwordProtected: data.passwordProtected,
        password: data.password,
      })
    })

    files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

    return files
  } catch (error) {
    console.error("Firebase error:", error)
    return getAllStoredFilesLocal()
  }
}

export async function getFileById(id: string): Promise<FileMetadata | null> {
  if (!isFirebaseAvailable()) {
    console.log("[v0] Firebase not available, using localStorage")
    return getFileByIdLocal(id)
  }

  try {
    console.log("[v0] Fetching file by ID from Firebase:", id)

    const db = getDb()!
    const fileRef = doc(db, "files", id)
    const docSnap = await getDoc(fileRef)

    if (!docSnap.exists()) {
      console.log("[v0] No file found in Firebase for ID:", id)
      return getFileByIdLocal(id)
    }

    const data = docSnap.data()

    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      console.log("[v0] File expired, deleting:", id)
      await deleteFileMetadata(id)
      return null
    }

    console.log("[v0] Successfully fetched file from Firebase:", {
      id: data.id,
      filename: data.filename,
      originalName: data.originalName,
    })

    return {
      id: data.id,
      filename: data.filename,
      originalName: data.originalName,
      size: data.size,
      type: data.type,
      url: data.url,
      uploadedAt: data.uploadedAt,
      downloadCount: data.downloadCount,
      userId: data.userId,
      securityMode: data.securityMode,
      expiresAt: data.expiresAt,
      passwordProtected: data.passwordProtected,
      password: data.password,
    }
  } catch (error) {
    console.error("[v0] Firebase connection failed for file ID", id, ":", error)
    console.error("[v0] Error type:", typeof error)
    console.error("[v0] Error name:", error instanceof Error ? error.name : "Unknown")
    console.error("[v0] Error message:", error instanceof Error ? error.message : String(error))
    console.log("[v0] Falling back to local storage for file:", id)
    return getFileByIdLocal(id)
  }
}

function getFileByIdLocal(id: string): FileMetadata | null {
  const allFiles = getAllStoredFilesLocal()
  return allFiles.find((file) => file.id === id) || null
}

export async function updateDownloadCount(id: string): Promise<void> {
  try {
    const db = getDb()!
    const fileRef = doc(db, "files", id)
    const docSnap = await getDoc(fileRef)

    if (!docSnap.exists()) {
      console.error("File not found for download count update:", id)
      updateDownloadCountLocal(id)
      return
    }

    const currentCount = docSnap.data().downloadCount || 0
    await updateDoc(fileRef, {
      downloadCount: currentCount + 1,
    })

    console.log("[v0] Successfully updated download count in Firebase")
  } catch (error) {
    console.error("Failed to update download count in Firebase:", error)
    updateDownloadCountLocal(id)
  }
}

function updateDownloadCountLocal(id: string): void {
  if (typeof window !== "undefined") {
    const allFiles = getAllStoredFilesLocal()
    const updatedFiles = allFiles.map((file) =>
      file.id === id ? { ...file, downloadCount: file.downloadCount + 1 } : file,
    )
    localStorage.setItem("uploadedFiles", JSON.stringify(updatedFiles))
  }
}

export async function deleteFileMetadata(id: string): Promise<boolean> {
  console.log("[v0] Starting file deletion for ID:", id)

  if (!isFirebaseAvailable()) {
    console.log("[v0] Firebase not available, using localStorage for deletion")
    return deleteFileMetadataLocal(id)
  }

  try {
    const db = getDb()!
    const currentUserId = getUserSessionId()
    console.log("[v0] Current user ID:", currentUserId)

    const fileRef = doc(db, "files", id)
    const docSnap = await getDoc(fileRef)

    if (!docSnap.exists()) {
      console.log("[v0] File not found in Firebase")
      return deleteFileMetadataLocal(id)
    }

    const fileData = docSnap.data()
    if (fileData.userId !== currentUserId) {
      console.log("[v0] User not authorized to delete file")
      return false
    }

    console.log("[v0] Deleting file from storage and Firebase")

    try {
      if (fileData.url && fileData.url.includes("blob.vercel-storage.com")) {
        console.log("[v0] Deleting from Vercel Blob")
        await deleteFromBlob(fileData.url)
        console.log("[v0] Successfully deleted from Vercel Blob")
      } else {
        console.log("[v0] Deleting from Firebase Storage")
        await deleteFromFirebaseStorage(fileData.filename)
        console.log("[v0] Successfully deleted from Firebase Storage")
      }
    } catch (storageError) {
      console.error("[v0] Failed to delete from storage:", storageError)
    }

    await deleteDoc(fileRef)
    console.log("[v0] Successfully deleted file from Firebase")
    return true
  } catch (error) {
    console.error("[v0] Firebase error during deletion:", error)
    return deleteFileMetadataLocal(id)
  }
}

function deleteFileMetadataLocal(id: string): boolean {
  console.log("[v0] Attempting local storage deletion for ID:", id)

  if (typeof window !== "undefined") {
    const allFiles = getAllStoredFilesLocal()
    const currentUserId = getUserSessionId()
    const fileToDelete = allFiles.find((file) => file.id === id)

    if (!fileToDelete) {
      console.log("[v0] File not found in local storage")
      return false
    }

    if (fileToDelete.userId !== currentUserId) {
      console.log("[v0] User not authorized to delete file from local storage")
      return false
    }

    try {
      if (fileToDelete.url && fileToDelete.url.includes("blob.vercel-storage.com")) {
        console.log("[v0] Deleting from Vercel Blob (local)")
        deleteFromBlob(fileToDelete.url).catch(console.error)
        console.log("[v0] Initiated Vercel Blob deletion for local file")
      } else {
        console.log("[v0] Deleting from Firebase Storage (local)")
        deleteFromFirebaseStorage(fileToDelete.filename).catch(console.error)
        console.log("[v0] Initiated Firebase Storage deletion for local file")
      }
    } catch (storageError) {
      console.error("[v0] Failed to delete from storage:", storageError)
    }

    const updatedFiles = allFiles.filter((file) => file.id !== id)
    localStorage.setItem("uploadedFiles", JSON.stringify(updatedFiles))
    console.log("[v0] Successfully deleted file from local storage")
    return true
  }
  return false
}

export async function deleteFromFirebaseStorage(filename: string): Promise<void> {
  try {
    const storageInstance = getStorageInstance()!
    const fileRef = ref(storageInstance, `files/${filename}`)
    await deleteObject(fileRef)
    console.log("[v0] Successfully deleted file from Firebase Storage:", filename)
  } catch (error) {
    console.error("[v0] Failed to delete from Firebase Storage:", error)
    throw error
  }
}

export async function deleteFromBlob(url: string): Promise<void> {
  try {
    await fetch("/api/delete-blob", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
  } catch (error) {
    console.error("Failed to delete from blob:", error)
  }
}

export function startAutoCleanup(intervalMinutes = 1, expiryMinutes = 5): void {
  if (typeof window !== "undefined") {
    // Clear any existing interval
    const existingInterval = (window as any).fileCleanupInterval
    if (existingInterval) {
      clearInterval(existingInterval)
    }

    // Start new cleanup interval
    const interval = setInterval(
      () => {
        cleanupExpiredFiles(expiryMinutes)
      },
      intervalMinutes * 60 * 1000,
    )

      // Store interval reference
      ; (window as any).fileCleanupInterval = interval

    // Run cleanup immediately
    cleanupExpiredFiles(expiryMinutes)
  }
}

export function cleanupExpiredFiles(expiryMinutes = 5): void {
  if (typeof window !== "undefined") {
    const allFiles = getAllStoredFilesLocal()
    const now = new Date().getTime()
    const expiryTime = expiryMinutes * 60 * 1000

    const validFiles = allFiles.filter((file) => {
      const uploadTime = new Date(file.uploadedAt).getTime()
      const isExpired = now - uploadTime > expiryTime

      if (isExpired) {
        deleteFromFirebaseStorage(file.filename).catch(console.error)
      }

      return !isExpired
    })

    if (validFiles.length !== allFiles.length) {
      localStorage.setItem("uploadedFiles", JSON.stringify(validFiles))
    }
  }
}

export function getTimeUntilDeletion(uploadedAt: string, expiryMinutes: number): number {
  const uploadTime = new Date(uploadedAt).getTime()
  const now = new Date().getTime()
  const expiryTime = expiryMinutes * 60 * 1000
  const elapsed = now - uploadTime
  const remaining = expiryTime - elapsed
  return Math.max(0, remaining)
}

export function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return "곧 삭제됨"

  const minutes = Math.floor(milliseconds / (1000 * 60))
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000)

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초 후 삭제`
  } else {
    return `${seconds}초 후 삭제`
  }
}

export function getTimeUntilExpiry(expiresAt?: string): number {
  if (!expiresAt) return 0
  const expiryTime = new Date(expiresAt).getTime()
  const now = new Date().getTime()
  return Math.max(0, expiryTime - now)
}

export function formatExpiryTime(milliseconds: number): string {
  if (milliseconds <= 0) return "만료됨"

  const minutes = Math.floor(milliseconds / (1000 * 60))
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000)

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초 후 삭제`
  } else {
    return `${seconds}초 후 삭제`
  }
}

export interface SecuritySettings {
  encryptionEnabled: boolean
  passwordProtection: boolean
  allowedFileTypes: string[]
  maxFileSize: number
  rateLimitEnabled: boolean
}

export interface UploadStatistics {
  totalUploads: number
  totalSize: number
  uploadsToday: number
  mostUploadedType: string
  averageFileSize: number
  uploadsThisHour: number
  totalDownloads: number
  activeFiles: number
}

export interface BulkUploadProgress {
  total: number
  completed: number
  failed: number
  currentFile: string
}

export interface GlobalMetadata {
  files: FileMetadata[]
  totalVisitors: number
  dailyVisitors: number
  lastVisitorReset: string
  totalDownloads: number
}

export function getSecuritySettings(): SecuritySettings {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("securitySettings")
    return stored
      ? JSON.parse(stored)
      : {
        encryptionEnabled: false,
        passwordProtection: false,
        allowedFileTypes: [],
        maxFileSize: 1024 * 1024 * 1024, // 1GB
        rateLimitEnabled: false,
      }
  }
  return {
    encryptionEnabled: false,
    passwordProtection: false,
    allowedFileTypes: [],
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    rateLimitEnabled: false,
  }
}

export function updateSecuritySettings(settings: Partial<SecuritySettings>): void {
  if (typeof window !== "undefined") {
    const current = getSecuritySettings()
    const updated = { ...current, ...settings }
    localStorage.setItem("securitySettings", JSON.stringify(updated))
  }
}

export function getUploadStatistics(): UploadStatistics {
  const files = getAllStoredFilesLocal()
  const today = new Date().toDateString()
  const todayFiles = files.filter((file) => new Date(file.uploadedAt).toDateString() === today)
  const now = Date.now()
  const oneHourAgo = now - 60 * 60 * 1000

  const typeCount: { [key: string]: number } = {}
  files.forEach((file) => {
    const type = file.type.split("/")[0] || "unknown"
    typeCount[type] = (typeCount[type] || 0) + 1
  })

  const mostUploadedType = Object.keys(typeCount).reduce((a, b) => (typeCount[a] > typeCount[b] ? a : b), "none")

  return {
    totalUploads: files.length,
    totalSize: files.reduce((sum, file) => sum + file.size, 0),
    uploadsToday: todayFiles.length,
    mostUploadedType,
    averageFileSize: files.length > 0 ? files.reduce((sum, file) => sum + file.size, 0) / files.length : 0,
    uploadsThisHour: files.filter((file) => new Date(file.uploadedAt).getTime() > oneHourAgo).length,
    totalDownloads: files.reduce((sum, file) => sum + (file.downloadCount || 0), 0),
    activeFiles: files.filter((file) => file.expiresAt && new Date(file.expiresAt).getTime() > now).length,
  }
}

export function validateFile(file: File, settings: SecuritySettings): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > settings.maxFileSize) {
    return { valid: false, error: `파일 크기가 ${Math.round(settings.maxFileSize / 1024 / 1024)}MB를 초과합니다.` }
  }

  if (settings.allowedFileTypes.length > 0) {
    const fileType = file.type.split("/")[0]
    if (!settings.allowedFileTypes.includes(fileType)) {
      return { valid: false, error: `허용되지 않는 파일 형식입니다.` }
    }
  }

  const dangerousExtensions = [".exe", ".bat", ".cmd", ".scr"]
  const fileName = file.name.toLowerCase()
  if (dangerousExtensions.some((ext) => fileName.endsWith(ext))) {
    return { valid: false, error: "보안상 위험한 파일 형식입니다." }
  }

  return { valid: true }
}

export function checkRateLimit(): { allowed: boolean; resetTime?: number } {
  if (typeof window !== "undefined") {
    const settings = getSecuritySettings()
    if (!settings.rateLimitEnabled) return { allowed: true }

    const now = Date.now()
    const rateLimitData = localStorage.getItem("rateLimit")

    if (!rateLimitData) {
      localStorage.setItem("rateLimit", JSON.stringify({ count: 1, resetTime: now + 60000 }))
      return { allowed: true }
    }

    const { count, resetTime } = JSON.parse(rateLimitData)

    if (now > resetTime) {
      localStorage.setItem("rateLimit", JSON.stringify({ count: 1, resetTime: now + 60000 }))
      return { allowed: true }
    }

    if (count >= 50) {
      return { allowed: false, resetTime }
    }

    localStorage.setItem("rateLimit", JSON.stringify({ count: count + 1, resetTime }))
    return { allowed: true }
  }
  return { allowed: true }
}

export function generateSecureFileId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""

  // Use crypto.getRandomValues for better security if available
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(4)
    window.crypto.getRandomValues(array)
    for (let i = 0; i < 4; i++) {
      result += chars[array[i] % chars.length]
    }
  } else {
    // Fallback to Math.random
    for (let i = 0; i < 4; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
  }

  return result
}

export async function getGlobalMetadata(): Promise<GlobalMetadata> {
  try {
    const db = getDb()!
    const metadataRef = doc(db, "global_metadata", "stats")
    const docSnap = await getDoc(metadataRef)

    if (!docSnap.exists()) {
      console.log("No global metadata found, creating default")
      const defaultMetadata = {
        totalVisitors: 0,
        dailyVisitors: 0,
        lastVisitorReset: new Date().toDateString(),
        totalDownloads: 0,
      }
      await setDoc(metadataRef, defaultMetadata)

      const files = getAllStoredFilesLocal()
      return { files, ...defaultMetadata }
    }

    const data = docSnap.data()
    const files = getAllStoredFilesLocal()

    return {
      files,
      totalVisitors: data.totalVisitors,
      dailyVisitors: data.dailyVisitors,
      lastVisitorReset: data.lastVisitorReset,
      totalDownloads: data.totalDownloads,
    }
  } catch (error) {
    console.error("Firebase error:", error)
    return getGlobalMetadataLocal()
  }
}

async function getGlobalMetadataLocal(): Promise<GlobalMetadata> {
  return {
    files: [],
    totalVisitors: 0,
    dailyVisitors: 0,
    lastVisitorReset: new Date().toDateString(),
    totalDownloads: 0,
  }
}

export async function saveFileMetadataGlobal(metadata: FileMetadata): Promise<void> {
  try {
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    })

    // 로컬 스토리지에도 저장 (백업용)
    saveFileMetadataLocal(metadata)
  } catch (error) {
    console.error("Failed to save file metadata globally:", error)
    // 실패 시 로컬 스토리지에만 저장
    saveFileMetadataLocal(metadata)
  }
}

export async function getGlobalFiles(): Promise<FileMetadata[]> {
  try {
    const metadata = await getGlobalMetadata()
    return metadata.files
  } catch (error) {
    console.error("Failed to get global files:", error)
    return getAllStoredFilesLocal() // 실패 시 로컬 스토리지 사용
  }
}

export async function updateDownloadCountGlobal(id: string): Promise<void> {
  try {
    await fetch("/api/download-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: id }),
    })

    // 로컬 스토리지도 업데이트
    updateDownloadCountLocal(id)
  } catch (error) {
    console.error("Failed to update download count globally:", error)
    // 실패 시 로컬 스토리지만 업데이트
    updateDownloadCountLocal(id)
  }
}

export async function updateFileMetadata(
  id: string,
  updates: Partial<Pick<FileMetadata, "originalName" | "expiresAt">>,
): Promise<boolean> {
  if (!isFirebaseAvailable()) {
    console.log("[v0] Firebase not available, using localStorage for update")
    return updateFileMetadataLocal(id, updates)
  }

  try {
    const db = getDb()!
    const currentUserId = getUserSessionId()
    const fileRef = doc(db, "files", id)
    const docSnap = await getDoc(fileRef)

    if (!docSnap.exists()) {
      console.log("[v0] File not found in Firebase")
      return updateFileMetadataLocal(id, updates)
    }

    const fileData = docSnap.data()
    if (fileData.userId !== currentUserId) {
      console.log("[v0] User not authorized to update file")
      throw new Error("Unauthorized")
    }

    // Sanitize updates to remove undefined values which Firebase doesn't support
    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    )

    await updateDoc(fileRef, sanitizedUpdates)
    console.log("[v0] Successfully updated file metadata in Firebase")
    return true
  } catch (error) {
    console.error("[v0] Firebase error during update:", error)
    return updateFileMetadataLocal(id, updates)
  }
}

function updateFileMetadataLocal(id: string, updates: Partial<FileMetadata>): boolean {
  if (typeof window !== "undefined") {
    const allFiles = getAllStoredFilesLocal()
    const updatedFiles = allFiles.map((file) => (file.id === id ? { ...file, ...updates } : file))
    localStorage.setItem("uploadedFiles", JSON.stringify(updatedFiles))
    return true
  }
  return false
}

export async function verifyFilePassword(file: FileMetadata, inputPassword: string): Promise<boolean> {
  if (!file.passwordProtected || !file.password) {
    return true // 비밀번호 보호가 없는 파일은 항상 접근 가능
  }

  // 레거시 평문 비밀번호 지원 (마이그레이션 기간 동안)
  if (!file.password.startsWith('$2')) {
    console.warn('[Security] Legacy plaintext password detected for file:', file.id)
    return file.password === inputPassword
  }

  // 해시된 비밀번호 검증
  try {
    const { verifyPassword } = await import('@/lib/password')
    return await verifyPassword(inputPassword, file.password)
  } catch (error) {
    console.error('[Security] Password verification failed:', error)
    return false
  }
}

function saveFileMetadataLocal(metadata: FileMetadata): void {
  if (typeof window !== "undefined") {
    const existingFiles = getAllStoredFilesLocal()
    const updatedFiles = [...existingFiles, metadata]
    localStorage.setItem("uploadedFiles", JSON.stringify(updatedFiles))
  }
}
