"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Upload,
  FileText,
  Copy,
  Check,
  Clock,
  Trash2,
  Settings,
  BarChart3,
  Shield,
  Zap,
  Menu,
  X,
  Archive,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { storage } from "@/lib/firebase/config"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import {
  type FileMetadata,
  saveFileMetadata,
  getStoredFiles,
  startAutoCleanup,
  deleteFileMetadata,
  getUserSessionId,
  getTimeUntilExpiry,
  formatExpiryTime,
  getSecuritySettings,
  updateSecuritySettings,
  getUploadStatistics,
  checkRateLimit,
  updateDownloadCount,
  generateFileId,
} from "@/lib/file-storage"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type PasswordProtection = {
  enabled: boolean
  password: string
}

type BulkUploadProgress = {
  total: number
  completed: number
  failed: number
  currentFile: string
}

type UploadStatistics = {
  totalUploads: number
  uploadsToday: number
  totalSize: number
  averageFileSize: number
  mostUploadedType: string
  uploadsThisHour: number
  totalDownloads: number
  activeFiles: number
}

type FileProgress = {
  fileId: string
  fileName: string
  progress: number
  status: "uploading" | "deleting" | "completed" | "error"
}

export default function HomePage() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<FileMetadata[]>([])
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null)
  const [autoDeleteMinutes, setAutoDeleteMinutes] = useState(5)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [leftDropdownOpen, setLeftDropdownOpen] = useState(false)
  const [rightDropdownOpen, setRightDropdownOpen] = useState(false)
  const [securityMode, setSecurityMode] = useState(false)
  const [bulkUploadMode, setBulkUploadMode] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<BulkUploadProgress | null>(null)
  const [uploadStats, setUploadStats] = useState<UploadStatistics | null>(null)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([])
  const [compressionEnabled, setCompressionEnabled] = useState(false)
  const [passwordProtection, setPasswordProtection] = useState<PasswordProtection>({
    enabled: false,
    password: "",
  })
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { toast } = useToast()
  const [darkMode, setDarkMode] = useState(false)
  const [previewEnabled, setPreviewEnabled] = useState(true)
  const [autoBackup, setAutoBackup] = useState(false)
  const [showLinkPopup, setShowLinkPopup] = useState(false)
  const [uploadedFileLink, setUploadedFileLink] = useState<{
    id: string
    name: string
    url: string
  } | null>(null)

  const compressFile = async (file: File): Promise<File> => {
    if (!compressionEnabled || file.size < 1024 * 1024) {
      // Skip compression for files < 1MB
      return file
    }

    try {
      // For images, use canvas compression
      if (file.type.startsWith("image/")) {
        return await compressImage(file)
      }

      // For other files, return original (could implement other compression methods)
      return file
    } catch (error) {
      console.error("Compression failed:", error)
      return file
    }
  }

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions (max 1920x1080)
        let { width, height } = img
        const maxWidth = 1920
        const maxHeight = 1080

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height

        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            } else {
              resolve(file)
            }
          },
          file.type,
          0.8,
        ) // 80% quality
      }

      img.src = URL.createObjectURL(file)
    })
  }

  const calculateEnhancedStats = (): UploadStatistics => {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    const stats = getUploadStatistics()
    const recentFiles = uploadedFiles.filter((file) => new Date(file.uploadedAt).getTime() > oneHourAgo)
    const todayFiles = uploadedFiles.filter((file) => new Date(file.uploadedAt).getTime() > oneDayAgo)

    return {
      ...stats,
      uploadsThisHour: recentFiles.length,
      uploadsToday: todayFiles.length,
      totalDownloads: uploadedFiles.reduce((sum, file) => sum + (file.downloadCount || 0), 0),
      activeFiles: uploadedFiles.filter((file) => new Date(file.expiresAt).getTime() > now).length,
    }
  }

  const loadFiles = async () => {
    try {
      const files = await getStoredFiles()
      setUploadedFiles(Array.isArray(files) ? files : [])
      setUploadStats(calculateEnhancedStats())
    } catch (error) {
      console.error("Failed to load files:", error)
      setUploadedFiles([])
    }
  }

  useEffect(() => {
    loadFiles()

    const savedDeleteTime = localStorage.getItem("autoDeleteMinutes")
    if (savedDeleteTime) {
      setAutoDeleteMinutes(Number.parseInt(savedDeleteTime))
    }

    const savedDarkMode = localStorage.getItem("darkMode") === "true"
    const savedCompression = localStorage.getItem("compressionEnabled") === "true"
    const savedPreview = localStorage.getItem("previewEnabled") !== "false"
    const savedAutoBackup = localStorage.getItem("autoBackup") === "true"

    setDarkMode(savedDarkMode)
    setCompressionEnabled(savedCompression)
    setPreviewEnabled(savedPreview)
    setAutoBackup(savedAutoBackup)

    startAutoCleanup(1, 5)

    const settings = getSecuritySettings()
    setSecurityMode(settings.encryptionEnabled)
    setUploadStats(getUploadStatistics())
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
      if (uploadedFiles.length > 0) {
        setUploadStats(calculateEnhancedStats())
      }
    }, 5000) // 5초마다 업데이트

    return () => clearInterval(timer)
  }, [uploadedFiles])

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    localStorage.setItem("darkMode", newDarkMode.toString())
    document.documentElement.classList.toggle("dark", newDarkMode)
    toast({
      title: newDarkMode ? "다크 모드 활성화" : "라이트 모드 활성화",
      description: "테마가 변경되었습니다.",
    })
  }

  const toggleCompression = () => {
    const newCompression = !compressionEnabled
    setCompressionEnabled(newCompression)
    localStorage.setItem("compressionEnabled", newCompression.toString())
    toast({
      title: newCompression ? "파일 압축 활성화" : "파일 압축 비활성화",
      description: newCompression ? "업로드 시 파일이 압축됩니다." : "원본 파일로 업로드됩니다.",
    })
  }

  const togglePreview = () => {
    const newPreview = !previewEnabled
    setPreviewEnabled(newPreview)
    localStorage.setItem("previewEnabled", newPreview.toString())
    toast({
      title: newPreview ? "파일 미리보기 활성화" : "파일 미리보기 비활성화",
      description: newPreview ? "이미지 파일을 미리 볼 수 있습니다." : "미리보기가 비활성화되었습니다.",
    })
  }

  const toggleAutoBackup = () => {
    const newAutoBackup = !autoBackup
    setAutoBackup(newAutoBackup)
    localStorage.setItem("autoBackup", newAutoBackup.toString())
    toast({
      title: newAutoBackup ? "자동 백업 활성화" : "자동 백업 비활성화",
      description: newAutoBackup ? "파일이 자동으로 백업됩니다." : "자동 백업이 비활성화되었습니다.",
    })
  }

  const togglePasswordProtection = () => {
    if (passwordProtection.enabled) {
      setPasswordProtection({ enabled: false, password: "" })
      setShowPasswordInput(false)
      toast({
        title: "비밀번호 보호 비활성화",
        description: "파일이 공개적으로 업로드됩니다.",
      })
    } else {
      setShowPasswordInput(true)
    }
  }

  const setFilePassword = () => {
    if (passwordProtection.password.length < 4) {
      toast({
        title: "비밀번호 오류",
        description: "비밀번호는 최소 4자 이상이어야 합니다.",
        variant: "destructive",
      })
      return
    }

    setPasswordProtection({ ...passwordProtection, enabled: true })
    setShowPasswordInput(false)
    toast({
      title: "비밀번호 보호 활성화",
      description: "업로드되는 파일이 비밀번호로 보호됩니다.",
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    const items = Array.from(e.dataTransfer.items)

    const allFiles: File[] = []

    const processItems = async () => {
      for (const item of items) {
        if (item.kind === "file") {
          const entry = item.webkitGetAsEntry()
          if (entry) {
            await processEntry(entry, allFiles)
          }
        }
      }

      if (allFiles.length > 0) {
        uploadFiles(allFiles)
      } else if (files.length > 0) {
        uploadFiles(files)
      }
    }

    processItems()
  }

  const processEntry = async (entry: any, files: File[]): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => {
        entry.file((file: File) => resolve(file))
      })
      files.push(file)
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const entries = await new Promise<any[]>((resolve) => {
        reader.readEntries((entries: any[]) => resolve(entries))
      })

      for (const childEntry of entries) {
        await processEntry(childEntry, files)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      uploadFiles(files)
    }
  }

  const uploadFileWithProgress = (file: File, fileId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append("file", file)
      formData.append("fileId", fileId)
      if (passwordProtection.enabled) {
        formData.append("password", passwordProtection.password)
      }

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setFileProgresses((prev) =>
            prev.map((fp) => (fp.fileId === fileId ? { ...fp, progress, status: "uploading" as const } : fp)),
          )
        }
      })

      xhr.addEventListener("load", async () => {
        if (xhr.status === 200) {
          try {
            const fileName = `${fileId}.${file.name.split(".").pop() || "bin"}`
            const storageRef = ref(storage, `files/${fileName}`)
            const snapshot = await uploadBytes(storageRef, file)
            const downloadURL = await getDownloadURL(snapshot.ref)

            setFileProgresses((prev) =>
              prev.map((fp) => (fp.fileId === fileId ? { ...fp, progress: 100, status: "completed" as const } : fp)),
            )

            resolve(downloadURL)
          } catch (error) {
            setFileProgresses((prev) =>
              prev.map((fp) => (fp.fileId === fileId ? { ...fp, status: "error" as const } : fp)),
            )
            reject(error)
          }
        } else {
          setFileProgresses((prev) =>
            prev.map((fp) => (fp.fileId === fileId ? { ...fp, status: "error" as const } : fp)),
          )
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      })

      xhr.addEventListener("error", () => {
        setFileProgresses((prev) => prev.map((fp) => (fp.fileId === fileId ? { ...fp, status: "error" as const } : fp)))
        reject(new Error("Upload failed"))
      })

      xhr.open("POST", "/api/upload-progress")
      xhr.send(formData)
    })
  }

  const uploadFiles = async (files: File[]) => {
    console.log("[v0] uploadFiles called with", files.length, "files")
    setIsUploading(true)
    const settings = getSecuritySettings()

    console.log("[v0] Checking for Korean filenames...")
    const hasKoreanFilename = files.some((file) => {
      const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(file.name)
      console.log("[v0] File:", file.name, "has Korean:", hasKorean)
      return hasKorean
    })

    console.log("[v0] Has Korean filename:", hasKoreanFilename)

    if (hasKoreanFilename) {
      console.log("[v0] Blocking upload due to Korean filename")
      toast({
        title: "파일명 오류",
        description: "파일 이름은 영어로 되어야됩니다",
        variant: "destructive",
      })
      setIsUploading(false)
      return
    }

    const rateLimitCheck = checkRateLimit()
    if (!rateLimitCheck.allowed) {
      console.log("[v0] Rate limit exceeded")
      toast({
        title: "업로드 제한",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
      setIsUploading(false)
      return
    }

    const initialProgresses: FileProgress[] = files.map((file) => ({
      fileId: generateFileId(),
      fileName: file.name,
      progress: 0,
      status: "uploading" as const,
    }))
    setFileProgresses(initialProgresses)

    if (files.length > 1) {
      setBulkUploadMode(true)
      setUploadProgress({
        total: files.length,
        completed: 0,
        failed: 0,
        currentFile: files[0].name,
      })
    }

    try {
      for (let i = 0; i < files.length; i++) {
        let file = files[i]
        const fileProgress = initialProgresses[i]
        console.log("[v0] Processing file:", file.name, "size:", file.size)

        if (compressionEnabled) {
          file = await compressFile(file)
          console.log("[v0] File compressed. New size:", file.size)
        }

        if (bulkUploadMode && uploadProgress) {
          setUploadProgress((prev) =>
            prev
              ? {
                  ...prev,
                  currentFile: file.name,
                }
              : null,
          )
        }

        try {
          const downloadURL = await uploadFileWithProgress(file, fileProgress.fileId)

          console.log("[v0] File uploaded successfully. Download URL:", downloadURL)

          const fileMetadata: FileMetadata = {
            id: fileProgress.fileId,
            filename: `${fileProgress.fileId}.${file.name.split(".").pop() || "bin"}`,
            originalName: file.name,
            size: file.size,
            type: file.type,
            url: downloadURL,
            uploadedAt: new Date().toISOString(),
            downloadCount: 0,
            userId: getUserSessionId(),
            expiresAt: new Date(Date.now() + autoDeleteMinutes * 60 * 1000).toISOString(),
            passwordProtected: passwordProtection.enabled,
            password: passwordProtection.enabled ? passwordProtection.password : undefined,
          }

          console.log("[v0] Saving file metadata:", fileMetadata)
          await saveFileMetadata(fileMetadata)
          await loadFiles()

          const shareUrl = `https://file.dyhs.kr/${fileProgress.fileId}`
          setUploadedFileLink({
            id: fileProgress.fileId,
            name: file.name,
            url: shareUrl,
          })
          setShowLinkPopup(true)

          if (uploadProgress) {
            setUploadProgress((prev) =>
              prev
                ? {
                    ...prev,
                    completed: prev.completed + 1,
                  }
                : null,
            )
          }

          toast({
            title: "파일 업로드 성공",
            description: `${file.name}이 성공적으로 업로드되었습니다.`,
          })
        } catch (uploadError) {
          console.error("[v0] Firebase Storage upload error:", uploadError)

          if (uploadProgress) {
            setUploadProgress((prev) =>
              prev
                ? {
                    ...prev,
                    failed: prev.failed + 1,
                  }
                : null,
            )
          }

          throw uploadError
        }
      }

      setUploadStats(calculateEnhancedStats())
    } catch (error) {
      console.error("[v0] Upload error:", error)
      toast({
        title: "업로드 실패",
        description: `파일 업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      setBulkUploadMode(false)
      setUploadProgress(null)
      setTimeout(() => {
        setFileProgresses([])
      }, 3000)
      await loadFiles()
    }
  }

  const deleteFileWithProgress = async (fileId: string, filename: string) => {
    setFileProgresses((prev) => [
      ...prev,
      {
        fileId,
        fileName: filename,
        progress: 0,
        status: "deleting" as const,
      },
    ])

    const progressInterval = setInterval(() => {
      setFileProgresses((prev) =>
        prev.map((fp) =>
          fp.fileId === fileId && fp.status === "deleting"
            ? { ...fp, progress: Math.min(fp.progress + Math.random() * 30, 90) }
            : fp,
        ),
      )
    }, 100)

    try {
      const success = await deleteFileMetadata(fileId)

      setFileProgresses((prev) =>
        prev.map((fp) => (fp.fileId === fileId ? { ...fp, progress: 100, status: "completed" as const } : fp)),
      )

      clearInterval(progressInterval)

      if (success) {
        await loadFiles()
        toast({
          title: "파일 삭제됨",
          description: `${filename}이 삭제되었습니다.`,
        })
      } else {
        toast({
          title: "삭제 실패",
          description: "파일을 삭제할 권한이 없습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      clearInterval(progressInterval)
      setFileProgresses((prev) => prev.map((fp) => (fp.fileId === fileId ? { ...fp, status: "error" as const } : fp)))
      toast({
        title: "삭제 실패",
        description: "파일 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }

    setTimeout(() => {
      setFileProgresses((prev) => prev.filter((fp) => fp.fileId !== fileId))
    }, 3000)
  }

  const deleteFile = async (fileId: string, filename: string) => {
    await deleteFileWithProgress(fileId, filename)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const downloadFile = async (file: FileMetadata) => {
    try {
      const response = await fetch(file.url)
      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = file.originalName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      await updateDownloadCount(file.id)
      toast({
        title: "다운로드 시작",
        description: `${file.originalName} 다운로드가 시작되었습니다.`,
      })
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description: "파일 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  const copyShareLink = async (fileId: string, filename: string) => {
    try {
      const shareUrl = `https://file.dyhs.kr/${fileId}`
      await navigator.clipboard.writeText(shareUrl)

      setCopiedFileId(fileId)
      setTimeout(() => setCopiedFileId(null), 2000)

      toast({
        title: "공유 링크 복사됨",
        description: `${filename}의 공유 링크가 클립보드에 복사되었습니다.`,
      })
    } catch (error) {
      const textArea = document.createElement("textarea")
      textArea.value = `https://file.dyhs.kr/${fileId}`
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)

      setCopiedFileId(fileId)
      setTimeout(() => setCopiedFileId(null), 2000)

      toast({
        title: "공유 링크 복사됨",
        description: `${filename}의 공유 링크가 클립보드에 복사되었습니다.`,
      })
    }
  }

  const handleToggleBulkUpload = () => {
    setBulkUploadMode(!bulkUploadMode)
    toast({
      title: bulkUploadMode ? "일괄 업로드 비활성화" : "일괄 업로드 활성화",
      description: bulkUploadMode
        ? "단일 파일 업로드 모드로 전환되었습니다."
        : "여러 파일을 동시에 업로드할 수 있습니다.",
    })
  }

  const copyLinkFromPopup = async () => {
    if (!uploadedFileLink) return

    try {
      await navigator.clipboard.writeText(uploadedFileLink.url)
      toast({
        title: "링크 복사됨",
        description: "파일 링크가 클립보드에 복사되었습니다.",
      })
    } catch (error) {
      const textArea = document.createElement("textarea")
      textArea.value = uploadedFileLink.url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)

      toast({
        title: "링크 복사됨",
        description: "파일 링크가 클립보드에 복사되었습니다.",
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {showPasswordInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">비밀번호 설정</h3>
              <button
                onClick={() => setShowPasswordInput(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">파일 보호 비밀번호</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={passwordProtection.password}
                    onChange={(e) => setPasswordProtection({ ...passwordProtection, password: e.target.value })}
                    placeholder="최소 4자 이상 입력하세요"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPasswordInput(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={setFilePassword}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  설정
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStatsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">상세 통계</h3>
              <button
                onClick={() => setShowStatsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {uploadStats && (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium">총 업로드</span>
                  <span className="font-bold text-blue-600">{uploadStats.totalUploads}개</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium">오늘 업로드</span>
                  <span className="font-bold text-green-600">{uploadStats.uploadsToday}개</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span className="text-sm font-medium">이번 시간</span>
                  <span className="font-bold text-orange-600">{uploadStats.uploadsThisHour}개</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="text-sm font-medium">총 용량</span>
                  <span className="font-bold text-purple-600">{formatFileSize(uploadStats.totalSize)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
                  <span className="text-sm font-medium">총 다운로드</span>
                  <span className="font-bold text-indigo-600">{uploadStats.totalDownloads}회</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-pink-50 rounded-lg">
                  <span className="text-sm font-medium">활성 파일</span>
                  <span className="font-bold text-pink-600">{uploadStats.activeFiles}개</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`side-dropdown left ${leftDropdownOpen ? "open" : ""}`}>
        <div className="dropdown-content">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">시스템 설정</h3>
            <button
              onClick={() => setLeftDropdownOpen(false)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="dropdown-section">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              파일 관리
            </h4>
            <div className="space-y-2">
              <div className="feature-item">
                <Clock className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">자동 삭제 시간</p>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={autoDeleteMinutes}
                    onChange={(e) => setAutoDeleteMinutes(Number(e.target.value))}
                    className="w-full mt-1"
                  />
                  <p className="text-xs text-muted-foreground">{autoDeleteMinutes}분 후 삭제</p>
                </div>
              </div>
            </div>
          </div>

          <div className="dropdown-section">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              보안 설정
            </h4>
            <div className="space-y-2">
              <div className="feature-item">
                <Shield className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">보안 모드</p>
                  <p className="text-xs text-muted-foreground">파일 암호화 및 검증</p>
                </div>
                <button
                  onClick={() => {
                    setSecurityMode(!securityMode)
                    updateSecuritySettings({ encryptionEnabled: !securityMode })
                  }}
                  className={`w-12 h-6 rounded-full transition-colors ${securityMode ? "bg-primary" : "bg-gray-300"}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      securityMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="feature-item">
                <Upload className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">일괄 업로드</p>
                  <p className="text-xs text-muted-foreground">여러 파일 동시 처리</p>
                </div>
                <button
                  onClick={handleToggleBulkUpload}
                  className={`w-12 h-6 rounded-full transition-colors ${bulkUploadMode ? "bg-primary" : "bg-gray-300"}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      bulkUploadMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="dropdown-section">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              고급 기능
            </h4>
            <div className="space-y-2">
              <button
                onClick={toggleCompression}
                className="feature-item w-full text-left hover:bg-blue-50 transition-colors rounded-lg p-2"
              >
                <Archive className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">파일 압축</p>
                  <p className="text-xs text-muted-foreground">업로드 시 자동 압축 (이미지 파일)</p>
                </div>
                <div
                  className={`w-6 h-3 rounded-full transition-colors ml-auto ${compressionEnabled ? "bg-primary" : "bg-gray-300"}`}
                >
                  <div
                    className={`w-3 h-3 bg-white rounded-full transition-transform ${
                      compressionEnabled ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </div>
              </button>
              <button
                onClick={togglePasswordProtection}
                className="feature-item w-full text-left hover:bg-blue-50 transition-colors rounded-lg p-2"
              >
                <Lock className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">비밀번호 보호</p>
                  <p className="text-xs text-muted-foreground">
                    {passwordProtection.enabled ? "파일이 비밀번호로 보호됩니다" : "파일에 비밀번호를 설정하세요"}
                  </p>
                </div>
                <div
                  className={`w-6 h-3 rounded-full transition-colors ml-auto ${passwordProtection.enabled ? "bg-primary" : "bg-gray-300"}`}
                >
                  <div
                    className={`w-3 h-3 bg-white rounded-full transition-transform ${
                      passwordProtection.enabled ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`side-dropdown right ${rightDropdownOpen ? "open" : ""}`}>
        <div className="dropdown-content">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">파일 정보</h3>
            <button
              onClick={() => setRightDropdownOpen(false)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="dropdown-section">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              실시간 통계
            </h4>
            {uploadStats && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">총 업로드</span>
                  <span className="font-bold text-primary">{uploadStats.totalUploads}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">오늘 업로드</span>
                  <span className="font-bold text-green-500">{uploadStats.uploadsToday}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">이번 시간</span>
                  <span className="font-bold text-orange-500">{uploadStats.uploadsThisHour}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">총 용량</span>
                  <span className="font-bold text-blue-500">{formatFileSize(uploadStats.totalSize)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">총 다운로드</span>
                  <span className="font-bold text-purple-500">{uploadStats.totalDownloads}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">활성 파일</span>
                  <span className="font-bold text-pink-500">{uploadStats.activeFiles}</span>
                </div>
                <button
                  onClick={() => setShowStatsModal(true)}
                  className="w-full mt-3 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  상세 보기
                </button>
              </div>
            )}
          </div>

          <div className="dropdown-section">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              최근 파일
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Array.isArray(uploadedFiles) &&
                uploadedFiles.slice(0, 5).map((file, index) => (
                  <div key={index} className="feature-item">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.originalName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{file.downloadCount || 0}회 다운로드</span>
                      </div>
                    </div>
                  </div>
                ))}
              {uploadedFiles.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">업로드된 파일이 없습니다</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <button className="dropdown-trigger left" onClick={() => setLeftDropdownOpen(!leftDropdownOpen)}>
        <Menu className="h-5 w-5" />
      </button>

      <button className="dropdown-trigger right" onClick={() => setRightDropdownOpen(!rightDropdownOpen)}>
        <BarChart3 className="h-5 w-5" />
      </button>

      <header className="border-b border-border bg-gradient-to-r from-white to-blue-50/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Image
                  src="/deokyoung-logo.png"
                  alt="덕영고등학교 로고"
                  width={48}
                  height={48}
                  className="rounded-full animate-gentle-float"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  Dyhs File
                </h1>
                <p className="text-sm text-muted-foreground">file.dyhs.kr</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="stats-card">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{autoDeleteMinutes}분 후 삭제</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="max-w-md mx-auto mb-8">
            <div className="pill-container p-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-mono text-lg">file.dyhs.kr/abcd</span>
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-4">
            파일을 업로드하고 공유하세요
          </h2>
          <p className="text-muted-foreground text-lg">간단하고 빠른 파일 공유 서비스</p>
          <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>최대 1GB 파일 지원</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>자동 삭제로 안전한 공유</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>모든 파일 형식 및 폴더 지원</span>
            </div>
          </div>
        </div>

        {fileProgresses.length > 0 && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="space-y-3">
              {fileProgresses.map((fileProgress) => (
                <div key={fileProgress.fileId} className="bg-white rounded-2xl p-4 shadow-lg border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-foreground truncate flex-1 mr-4">
                      {fileProgress.status === "uploading" && "업로드 중"}
                      {fileProgress.status === "deleting" && "삭제 중"}
                      {fileProgress.status === "completed" && "완료"}
                      {fileProgress.status === "error" && "오류"}: {fileProgress.fileName}
                    </h4>
                    <span className="text-sm font-bold text-primary">{fileProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        fileProgress.status === "error"
                          ? "bg-red-500"
                          : fileProgress.status === "completed"
                            ? "bg-green-500"
                            : fileProgress.status === "deleting"
                              ? "bg-orange-500"
                              : "bg-blue-500"
                      }`}
                      style={{ width: `${fileProgress.progress}%` }}
                    />
                  </div>
                  {fileProgress.status === "error" && <p className="text-sm text-red-500 mt-1">오류가 발생했습니다</p>}
                  {fileProgress.status === "completed" && <p className="text-sm text-green-500 mt-1">완료되었습니다</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadProgress && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-foreground">일괄 업로드 진행중</h4>
                <span className="text-sm text-muted-foreground">
                  {uploadProgress.completed + uploadProgress.failed} / {uploadProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((uploadProgress.completed + uploadProgress.failed) / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">현재: {uploadProgress.currentFile}</p>
              {uploadProgress.failed > 0 && (
                <p className="text-sm text-destructive mt-2">실패: {uploadProgress.failed}개 파일</p>
              )}
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto mb-12">
          <div
            className={`upload-area transition-all duration-300 ${isDragging ? "scale-105" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="p-16 text-center text-white relative z-10">
              <div className="mb-6">
                <Upload className="h-16 w-16 mx-auto mb-4 opacity-90" />
                <h3 className="text-2xl font-bold mb-2">파일이나 폴더를 드롭하세요</h3>
                <p className="text-lg opacity-90">또는 클릭하여 파일을 선택하세요</p>
                {bulkUploadMode && (
                  <div className="mt-4 p-3 bg-white bg-opacity-20 rounded-lg">
                    <p className="text-sm font-medium">일괄 업로드 모드 활성화</p>
                    <p className="text-xs opacity-80">여러 파일을 동시에 선택할 수 있습니다</p>
                  </div>
                )}
              </div>
              <Input
                id="file-upload"
                type="file"
                multiple={bulkUploadMode}
                {...(bulkUploadMode ? { webkitdirectory: "" } : {})}
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              <button
                onClick={() => document.getElementById("file-upload")?.click()}
                className="pill-button text-lg px-8 py-3"
                disabled={isUploading}
              >
                {isUploading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    업로드 중...
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Upload className="h-5 w-5" />
                    파일/폴더 선택하기
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-foreground mb-6 text-center">
              업로드된 파일 ({uploadedFiles.length})
            </h3>
            <div className="space-y-4">
              {Array.isArray(uploadedFiles) &&
                uploadedFiles.slice(0, 5).map((file, index) => {
                  const timeRemaining = getTimeUntilExpiry(file.expiresAt)
                  const isExpiringSoon = timeRemaining < 60000

                  return (
                    <div key={index} className="file-item">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="p-3 bg-primary text-white rounded-xl">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate" title={file.originalName}>
                              {file.originalName}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{formatFileSize(file.size)}</span>
                              <div className={`flex items-center gap-1 ${isExpiringSoon ? "text-destructive" : ""}`}>
                                <Clock className="h-3 w-3" />
                                {formatExpiryTime(timeRemaining)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyShareLink(file.id, file.originalName)}
                            className="pill-button-outline"
                          >
                            {copiedFileId === file.id ? (
                              <>
                                <Check className="h-4 w-4 text-green-500" />
                                복사됨
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                공유
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => downloadFile(file)}
                            className="pill-button-outline inline-flex items-center gap-2"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-download h-4 w-4"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" x2="12" y1="15" y2="3"></line>
                            </svg>
                            다운로드
                          </button>
                          <button
                            onClick={() => deleteFile(file.id, file.originalName)}
                            className="pill-button-outline text-destructive hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-20 border-t border-border bg-gradient-to-r from-white to-blue-50/20">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-xl font-bold text-foreground mb-4">파일 공유가 이렇게 간단할 줄이야!</h3>
              <p className="text-muted-foreground">누구나 쉽게 사용할 수 있는 파일 공유 플랫폼</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-6 bg-white rounded-2xl shadow-sm border border-blue-100">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">간편한 업로드</h4>
                <p className="text-sm text-muted-foreground">드래그 앤 드롭으로 쉽게 파일을 업로드하세요</p>
              </div>

              <div className="text-center p-6 bg-white rounded-2xl shadow-sm border border-blue-100">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">안전한 공유</h4>
                <p className="text-sm text-muted-foreground">자동 삭제로 개인정보를 안전하게 보호합니다</p>
              </div>

              <div className="text-center p-6 bg-white rounded-2xl shadow-sm border border-blue-100">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">빠른 처리</h4>
                <p className="text-sm text-muted-foreground">즉시 공유 링크를 생성하고 다운로드할 수 있습니다</p>
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>© 2025 Dyhs File. 모든 사용자가 안전하고 편리하게 파일을 공유할 수 있도록 지원합니다.</p>
            </div>
          </div>
        </div>
      </footer>

      <Dialog open={showLinkPopup} onOpenChange={setShowLinkPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-primary">파일 업로드 완료! 🎉</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {uploadedFileLink && (
              <>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">파일명</p>
                  <p className="font-medium text-foreground truncate" title={uploadedFileLink.name}>
                    {uploadedFileLink.name}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">공유 링크</p>
                  <div className="bg-muted rounded-lg p-4 border-2 border-dashed border-primary/30">
                    <p className="text-center font-mono text-lg font-bold text-primary break-all">
                      {uploadedFileLink.url}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={copyLinkFromPopup}
                    className="pill-button flex-1 flex items-center justify-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    링크 복사
                  </button>
                  <button onClick={() => setShowLinkPopup(false)} className="pill-button-outline flex-1">
                    닫기
                  </button>
                </div>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">💡 이 링크를 복사해서 다른 사람과 공유하세요!</p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
