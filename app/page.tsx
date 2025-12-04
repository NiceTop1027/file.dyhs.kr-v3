"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
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
  X,
  Archive,
  Lock,
  Eye,
  EyeOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronRight,
  ChevronLeft,
  QrCode,
  Search,
  Edit2,
  Plus,
  Moon,
  Sun,
  Bell,
  BellOff,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { storage } from "@/lib/firebase/config"
import { ref, getDownloadURL, uploadBytesResumable } from "firebase/storage"
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
  updateFileMetadata, // Added
} from "@/lib/file-storage"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox" // Added
import { motion } from "framer-motion" // Added AnimatePresence
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel, // Added
  type SortingState,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table"
import { QRCodeSVG } from "qrcode.react" // Added

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

  const [showQRModal, setShowQRModal] = useState(false)
  const [qrCodeData, setQRCodeData] = useState<{ url: string; filename: string } | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameFile, setRenameFile] = useState<FileMetadata | null>(null)
  const [newFileName, setNewFileName] = useState("")
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [extendFile, setExtendFile] = useState<FileMetadata | null>(null)
  const [extendMinutes, setExtendMinutes] = useState(30)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  const [sorting, setSorting] = useState<SortingState>([])

  const compressFile = async (file: File): Promise<File> => {
    if (!compressionEnabled) {
      console.log("[v0] Compression disabled, returning original file")
      return file
    }

    // Skip compression for small files (< 500KB)
    if (file.size < 500 * 1024) {
      console.log("[v0] File too small for compression, returning original")
      return file
    }

    try {
      // For images, use canvas compression
      if (file.type.startsWith("image/")) {
        console.log("[v0] Compressing image file:", file.name)
        const compressed = await compressImage(file)
        console.log("[v0] Compression complete. Original:", file.size, "Compressed:", compressed.size)
        return compressed
      }

      // For other files, return original (could implement other compression methods)
      console.log("[v0] Non-image file, returning original")
      return file
    } catch (error) {
      console.error("[v0] Compression failed:", error)
      toast({
        title: "압축 실패",
        description: "파일 압축 중 오류가 발생했습니다. 원본 파일로 업로드합니다.",
        variant: "destructive",
      })
      return file
    }
  }

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = document.createElement("img") as HTMLImageElement

      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }

      img.onload = () => {
        try {
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

          if (!ctx) {
            reject(new Error("Failed to get canvas context"))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Only use compressed version if it's actually smaller
                if (blob.size < file.size) {
                  const compressedFile = new File([blob], file.name, {
                    type: file.type,
                    lastModified: Date.now(),
                  })
                  resolve(compressedFile)
                } else {
                  console.log("[v0] Compressed file is larger, using original")
                  resolve(file)
                }
              } else {
                reject(new Error("Failed to create blob"))
              }
            },
            file.type,
            0.85,
          ) // 85% quality for better compression
        } catch (error) {
          reject(error)
        }
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
      activeFiles: uploadedFiles.filter((file) => file.expiresAt && new Date(file.expiresAt).getTime() > now).length,
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
      const minutes = Number.parseInt(savedDeleteTime)
      const roundedMinutes = Math.round(minutes / 5) * 5
      setAutoDeleteMinutes(Math.max(5, roundedMinutes))
    }

    const savedDarkMode = localStorage.getItem("darkMode") === "true"
    const savedCompression = localStorage.getItem("compressionEnabled") === "true"
    const savedPreview = localStorage.getItem("previewEnabled") !== "false"
    const savedAutoBackup = localStorage.getItem("autoBackup") === "true"
    const savedNotifications = localStorage.getItem("notificationsEnabled") === "true" // Load notifications setting

    setDarkMode(savedDarkMode)
    setCompressionEnabled(savedCompression)
    setPreviewEnabled(savedPreview)
    setAutoBackup(savedAutoBackup)
    setNotificationsEnabled(savedNotifications) // Set notifications state

    if (savedDarkMode) {
      document.documentElement.classList.add("dark")
    }

    if (savedNotifications && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }

    startAutoCleanup(1, 5)

    const settings = getSecuritySettings()
    setSecurityMode(settings.encryptionEnabled)
    setUploadStats(getUploadStatistics())
  }, [])

  useEffect(() => {
    localStorage.setItem("autoDeleteMinutes", autoDeleteMinutes.toString())
  }, [autoDeleteMinutes])

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
    document.documentElement.classList.toggle("dark", newDarkMode) // Toggle dark mode class
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
      // Disable password protection
      setPasswordProtection({ enabled: false, password: "" })
      setShowPasswordInput(false)
      toast({
        title: "비밀번호 보호 비활성화",
        description: "파일이 공개적으로 업로드됩니다.",
      })
    } else {
      // Enable password protection - show input
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

  const uploadFileWithProgress = async (file: File, fileId: string): Promise<string> => {
    // Check if Firebase Storage is available
    if (!storage) {
      console.log("[v0] Firebase Storage not available, using localStorage")
      return new Promise((resolve) => {
        // Simulate progress for localStorage
        let progress = 0
        const interval = setInterval(() => {
          progress += 20
          setFileProgresses((prev) =>
            prev.map((fp) =>
              fp.fileId === fileId ? { ...fp, progress: Math.min(progress, 100), status: "uploading" as const } : fp,
            ),
          )
          if (progress >= 100) {
            clearInterval(interval)
            setFileProgresses((prev) =>
              prev.map((fp) => (fp.fileId === fileId ? { ...fp, progress: 100, status: "completed" as const } : fp)),
            )
            // Return a local URL for localStorage mode
            resolve(`local://${fileId}`)
          }
        }, 100)
      })
    }

    return new Promise((resolve, reject) => {
      try {
        if (!storage) {
          throw new Error('Firebase Storage not available')
        }
        const fileName = `${fileId}.${file.name.split(".").pop() || "bin"}`
        const storageRef = ref(storage, `files/${fileName}`)
        const uploadTask = uploadBytesResumable(storageRef, file)

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            // Track upload progress
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            console.log("[v0] Upload progress:", progress, "%")
            setFileProgresses((prev) =>
              prev.map((fp) => (fp.fileId === fileId ? { ...fp, progress, status: "uploading" as const } : fp)),
            )
          },
          (error) => {
            // Handle upload error
            console.error("[v0] Firebase upload error:", error)
            // Fallback to localStorage on error
            console.log("[v0] Falling back to localStorage")
            let progress = 0
            const interval = setInterval(() => {
              progress += 20
              setFileProgresses((prev) =>
                prev.map((fp) =>
                  fp.fileId === fileId
                    ? { ...fp, progress: Math.min(progress, 100), status: "uploading" as const }
                    : fp,
                ),
              )
              if (progress >= 100) {
                clearInterval(interval)
                setFileProgresses((prev) =>
                  prev.map((fp) =>
                    fp.fileId === fileId ? { ...fp, progress: 100, status: "completed" as const } : fp,
                  ),
                )
                resolve(`local://${fileId}`)
              }
            }, 100)
          },
          async () => {
            // Upload completed successfully
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
              console.log("[v0] Upload completed. Download URL:", downloadURL)
              setFileProgresses((prev) =>
                prev.map((fp) => (fp.fileId === fileId ? { ...fp, progress: 100, status: "completed" as const } : fp)),
              )
              resolve(downloadURL)
            } catch (error) {
              console.error("[v0] Failed to get download URL:", error)
              setFileProgresses((prev) =>
                prev.map((fp) => (fp.fileId === fileId ? { ...fp, status: "error" as const } : fp)),
              )
              reject(error)
            }
          },
        )
      } catch (error) {
        console.error("[v0] Firebase Storage initialization error:", error)
        // Fallback to localStorage
        let progress = 0
        const interval = setInterval(() => {
          progress += 20
          setFileProgresses((prev) =>
            prev.map((fp) =>
              fp.fileId === fileId ? { ...fp, progress: Math.min(progress, 100), status: "uploading" as const } : fp,
            ),
          )
          if (progress >= 100) {
            clearInterval(interval)
            setFileProgresses((prev) =>
              prev.map((fp) => (fp.fileId === fileId ? { ...fp, progress: 100, status: "completed" as const } : fp)),
            )
            resolve(`local://${fileId}`)
          }
        }, 100)
      }
    })
  }

  const uploadFiles = async (files: File[]) => {
    console.log("[v0] uploadFiles called with", files.length, "files")
    setIsUploading(true)

    const settings = getSecuritySettings()
    const useEncryption = securityMode && settings.encryptionEnabled

    if (useEncryption) {
      console.log("[v0] Security mode enabled - files will be encrypted")
    }

    // The backend already handles Korean filenames properly with UTF-8 encoding

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
          console.log("[v0] Attempting to compress file...")
          const originalSize = file.size
          file = await compressFile(file)
          const newSize = file.size
          const savedBytes = originalSize - newSize
          if (savedBytes > 0) {
            console.log("[v0] File compressed. Saved:", formatFileSize(savedBytes))
            toast({
              title: "파일 압축 완료",
              description: `${formatFileSize(savedBytes)} 절약되었습니다.`,
            })
          }
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
            encrypted: useEncryption,
          }

          console.log("[v0] Saving file metadata:", fileMetadata)
          await saveFileMetadata(fileMetadata)
          await loadFiles()

          const shareUrl = `https://share.dyhs.kr/${fileProgress.fileId}`
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

          showNotification("파일 업로드 완료", `${file.name}이 성공적으로 업로드되었습니다.`)
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
      const shareUrl = `https://share.dyhs.kr/${fileId}`
      await navigator.clipboard.writeText(shareUrl)

      setCopiedFileId(fileId)
      setTimeout(() => setCopiedFileId(null), 2000)

      toast({
        title: "공유 링크 복사됨",
        description: `${filename}의 공유 링크가 클립보드에 복사되었습니다.`,
      })
    } catch (error) {
      const textArea = document.createElement("textarea")
      textArea.value = `https://share.dyhs.kr/${fileId}`
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
    const newBulkUploadMode = !bulkUploadMode
    setBulkUploadMode(newBulkUploadMode)
    toast({
      title: newBulkUploadMode ? "일괄 업로드 활성화" : "일괄 업로드 비활성화",
      description: newBulkUploadMode
        ? "여러 파일을 동시에 선택할 수 있습니다."
        : "단일 파일 업로드 모드로 전환되었습니다.",
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

  const toggleNotifications = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "알림 지원 안 됨",
        description: "이 브라우저는 알림을 지원하지 않습니다.",
        variant: "destructive",
      })
      return
    }

    if (!notificationsEnabled) {
      const permission = await Notification.requestPermission()
      if (permission === "granted") {
        setNotificationsEnabled(true)
        localStorage.setItem("notificationsEnabled", "true")
        toast({
          title: "알림 활성화",
          description: "업로드 완료 시 알림을 받습니다.",
        })
      } else {
        toast({
          title: "알림 권한 거부됨",
          description: "브라우저 설정에서 알림 권한을 허용해주세요.",
          variant: "destructive",
        })
      }
    } else {
      setNotificationsEnabled(false)
      localStorage.setItem("notificationsEnabled", "false")
      toast({
        title: "알림 비활성화",
        description: "더 이상 알림을 받지 않습니다.",
      })
    }
  }

  const showNotification = (title: string, body: string) => {
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/deokyoung-logo.png",
      })
    }
  }

  const showQRCode = (fileId: string, filename: string) => {
    const shareUrl = `https://share.dyhs.kr/${fileId}`
    setQRCodeData({ url: shareUrl, filename })
    setShowQRModal(true)
  }

  const showFilePreview = (file: FileMetadata) => {
    setPreviewFile(file)
    setShowPreviewModal(true)
  }

  const batchDeleteFiles = async () => {
    if (selectedFiles.size === 0) {
      toast({
        title: "파일 선택 필요",
        description: "삭제할 파일을 선택해주세요.",
        variant: "destructive",
      })
      return
    }

    const confirmed = window.confirm(`선택한 ${selectedFiles.size}개의 파일을 삭제하시겠습니까?`)
    if (!confirmed) return

    for (const fileId of selectedFiles) {
      const file = uploadedFiles.find((f) => f.id === fileId)
      if (file) {
        await deleteFileWithProgress(fileId, file.originalName)
      }
    }

    setSelectedFiles(new Set())
    toast({
      title: "일괄 삭제 완료",
      description: `${selectedFiles.size}개의 파일이 삭제되었습니다.`,
    })
  }

  const handleRenameFile = async () => {
    if (!renameFile || !newFileName.trim()) {
      toast({
        title: "이름 입력 필요",
        description: "새 파일 이름을 입력해주세요.",
        variant: "destructive",
      })
      return
    }

    try {
      await updateFileMetadata(renameFile.id, {
        originalName: newFileName.trim(),
      })
      await loadFiles()
      setShowRenameModal(false)
      setRenameFile(null)
      setNewFileName("")
      toast({
        title: "이름 변경 완료",
        description: `파일 이름이 "${newFileName}"(으)로 변경되었습니다.`,
      })
    } catch (error) {
      toast({
        title: "이름 변경 실패",
        description: "파일 이름 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  const handleExtendExpiry = async () => {
    if (!extendFile || !extendFile.expiresAt) return

    try {
      const currentExpiry = new Date(extendFile.expiresAt).getTime()
      const newExpiry = new Date(currentExpiry + extendMinutes * 60 * 1000).toISOString()

      await updateFileMetadata(extendFile.id, {
        expiresAt: newExpiry,
      })
      await loadFiles()
      setShowExtendModal(false)
      setExtendFile(null)
      toast({
        title: "만료 시간 연장 완료",
        description: `${extendMinutes}분 연장되었습니다.`,
      })
    } catch (error) {
      toast({
        title: "연장 실패",
        description: "만료 시간 연장 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  const selectAllFiles = () => {
    const allFileIds = new Set(uploadedFiles.map((f) => f.id))
    setSelectedFiles(allFileIds)
  }

  const deselectAllFiles = () => {
    setSelectedFiles(new Set())
  }

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId)
    } else {
      newSelection.add(fileId)
    }
    setSelectedFiles(newSelection)
  }

  const columns = useMemo<ColumnDef<FileMetadata>[]>(
    () => [
      {
        id: "select", // Added checkbox column
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value)
              if (value) {
                selectAllFiles()
              } else {
                deselectAllFiles()
              }
            }}
            aria-label="모두 선택"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedFiles.has(row.original.id)}
            onCheckedChange={() => toggleFileSelection(row.original.id)}
            aria-label="행 선택"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "originalName",
        header: ({ column }) => {
          return (
            <button
              className="flex items-center gap-2 font-semibold hover:text-primary transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              파일명
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 opacity-50" />
              )}
            </button>
          )
        },
        cell: ({ row }) => {
          const file = row.original
          return (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate" title={file.originalName}>
                  {file.originalName}
                </p>
                {file.passwordProtected && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    <span>비밀번호 보호</span>
                  </div>
                )}
              </div>
            </div>
          )
        },
        filterFn: (row, id, value) => {
          // Added filter function
          return row.original.originalName.toLowerCase().includes(value.toLowerCase())
        },
      },
      {
        accessorKey: "size",
        header: ({ column }) => {
          return (
            <button
              className="flex items-center gap-2 font-semibold hover:text-primary transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              크기
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 opacity-50" />
              )}
            </button>
          )
        },
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatFileSize(row.original.size)}</span>,
      },
      {
        accessorKey: "downloadCount",
        header: ({ column }) => {
          return (
            <button
              className="flex items-center gap-2 font-semibold hover:text-primary transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              다운로드
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 opacity-50" />
              )}
            </button>
          )
        },
        cell: ({ row }) => (
          <span className="text-sm font-medium text-primary">{row.original.downloadCount || 0}회</span>
        ),
      },
      {
        accessorKey: "expiresAt",
        header: ({ column }) => {
          return (
            <button
              className="flex items-center gap-2 font-semibold hover:text-primary transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              만료 시간
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 opacity-50" />
              )}
            </button>
          )
        },
        cell: ({ row }) => {
          const timeRemaining = getTimeUntilExpiry(row.original.expiresAt)
          const isExpiringSoon = timeRemaining < 60000
          return (
            <div
              className={`flex items-center gap-1 text-sm ${isExpiringSoon ? "text-destructive" : "text-muted-foreground"}`}
            >
              <Clock className="h-3 w-3" />
              {formatExpiryTime(timeRemaining)}
            </div>
          )
        },
      },
      {
        id: "actions",
        header: () => <span className="font-semibold">작업</span>,
        cell: ({ row }) => {
          const file = row.original
          const canPreview = file.type.startsWith("image/") || file.type === "application/pdf" // Determine if file can be previewed
          return (
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyShareLink(file.id, file.originalName)}
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors group"
                title="공유 링크 복사"
              >
                {copiedFileId === file.id ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                )}
              </button>
              <button
                onClick={() => showQRCode(file.id, file.originalName)} // Show QR Code
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors group"
                title="QR 코드"
              >
                <QrCode className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </button>
              {canPreview &&
                previewEnabled && ( // Conditionally show preview button
                  <button
                    onClick={() => showFilePreview(file)}
                    className="p-2 hover:bg-primary/10 rounded-lg transition-colors group"
                    title="미리보기"
                  >
                    <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </button>
                )}
              <button // Added rename button
                onClick={() => {
                  setRenameFile(file)
                  setNewFileName(file.originalName)
                  setShowRenameModal(true)
                }}
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors group"
                title="이름 변경"
              >
                <Edit2 className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </button>
              <button // Added extend expiry button
                onClick={() => {
                  setExtendFile(file)
                  setShowExtendModal(true)
                }}
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors group"
                title="만료 시간 연장"
              >
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </button>
              <button
                onClick={() => downloadFile(file)}
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors group"
                title="다운로드"
              >
                <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </button>
              <button
                onClick={() => deleteFile(file.id, file.originalName)}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                title="삭제"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive" />
              </button>
            </div>
          )
        },
      },
    ],
    [copiedFileId, currentTime, selectedFiles, previewEnabled], // Added selectedFiles, previewEnabled to dependency array
  )

  const table = useReactTable({
    data: uploadedFiles,
    columns,
    state: {
      sorting,
      globalFilter: searchQuery, // Added globalFilter state
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearchQuery, // Added onGlobalFilterChange
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // Added getFilteredRowModel
    globalFilterFn: (row, columnId, filterValue) => {
      // Added globalFilterFn
      const file = row.original
      return file.originalName.toLowerCase().includes(filterValue.toLowerCase())
    },
  })

  return (
    <div className="min-h-screen bg-background">
      {/* ... existing modals ... */}
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

      <Dialog open={showStatsModal} onOpenChange={setShowStatsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              상세 통계
            </DialogTitle>
            <DialogDescription className="sr-only">
              업로드 및 다운로드 통계 상세 정보입니다.
            </DialogDescription>
          </DialogHeader>
          {uploadStats && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-xl border border-blue-200 dark:border-blue-800"
              >
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">총 업로드</span>
                <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{uploadStats.totalUploads}개</span>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-xl border border-green-200 dark:border-green-800"
              >
                <span className="text-sm font-medium text-green-900 dark:text-green-100">오늘 업로드</span>
                <span className="font-bold text-lg text-green-600 dark:text-green-400">
                  {uploadStats.uploadsToday}개
                </span>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 rounded-xl border border-orange-200 dark:border-orange-800"
              >
                <span className="text-sm font-medium text-orange-900 dark:text-orange-100">이번 시간</span>
                <span className="font-bold text-lg text-orange-600 dark:text-orange-400">
                  {uploadStats.uploadsThisHour}개
                </span>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-xl border border-purple-200 dark:border-purple-800"
              >
                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">총 용량</span>
                <span className="font-bold text-lg text-purple-600 dark:text-purple-400">
                  {formatFileSize(uploadStats.totalSize)}
                </span>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 rounded-xl border border-indigo-200 dark:border-indigo-800"
              >
                <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">총 다운로드</span>
                <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
                  {uploadStats.totalDownloads}회
                </span>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex justify-between items-center p-4 bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900 rounded-xl border border-pink-200 dark:border-pink-800"
              >
                <span className="text-sm font-medium text-pink-900 dark:text-pink-100">활성 파일</span>
                <span className="font-bold text-lg text-pink-600 dark:text-pink-400">{uploadStats.activeFiles}개</span>
              </motion.div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              QR 코드
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              QR 코드를 스캔하여 파일을 다운로드하세요.
            </DialogDescription>
          </DialogHeader>
          {qrCodeData && (
            <div className="space-y-6 py-4">
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-2xl shadow-lg">
                  <QRCodeSVG value={qrCodeData.url} size={256} level="H" includeMargin />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">파일명</p>
                <p className="font-medium text-foreground truncate" title={qrCodeData.filename}>
                  {qrCodeData.filename}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">QR 코드를 스캔하여 파일을 다운로드하세요</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              파일 미리보기
            </DialogTitle>
            <DialogDescription className="sr-only">
              선택한 파일의 미리보기입니다.
            </DialogDescription>
          </DialogHeader>
          {previewFile && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <p className="font-medium text-foreground mb-4">{previewFile.originalName}</p>
                {previewFile.type.startsWith("image/") && (
                  <div className="relative w-full max-h-[600px] flex items-center justify-center bg-muted rounded-lg overflow-hidden">
                    <img
                      src={previewFile.url || "/placeholder.svg"}
                      alt={previewFile.originalName}
                      className="max-w-full max-h-[600px] object-contain"
                    />
                  </div>
                )}
                {previewFile.type === "application/pdf" && (
                  <iframe src={previewFile.url} className="w-full h-[600px] rounded-lg border" />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameModal} onOpenChange={setShowRenameModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              파일 이름 변경
            </DialogTitle>
            <DialogDescription>
              파일의 새로운 이름을 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">새 파일 이름</label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="파일 이름을 입력하세요"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameFile()
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRenameModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleRenameFile}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                변경
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExtendModal} onOpenChange={setShowExtendModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              만료 시간 연장
            </DialogTitle>
            <DialogDescription>
              파일의 만료 시간을 연장합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-foreground">연장 시간</label>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                  {extendMinutes}분
                </span>
              </div>
              <Slider
                value={[extendMinutes]}
                onValueChange={(value) => setExtendMinutes(value[0])}
                min={5}
                max={120}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2">{extendMinutes}분 연장됩니다</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExtendModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleExtendExpiry}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                연장
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Left Sidebar - Settings & Features */}
      <Sheet open={leftDropdownOpen} onOpenChange={setLeftDropdownOpen}>
        <button
          className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-primary text-primary-foreground p-3 rounded-r-lg shadow-lg hover:bg-primary/90 transition-colors"
          onClick={() => setLeftDropdownOpen(!leftDropdownOpen)}
        >
          {leftDropdownOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold">설정 및 옵션</SheetTitle>
            <SheetDescription>
              보안 및 업로드 설정을 변경할 수 있습니다.
            </SheetDescription>
          </SheetHeader>
          <div className="py-6">

            {/* Security Settings */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">보안 옵션</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">암호화 모드</p>
                      <p className="text-xs text-muted-foreground">파일을 암호화하여 저장</p>
                    </div>
                  </div>
                  <Switch checked={securityMode} onCheckedChange={setSecurityMode} />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <Lock className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">비밀번호 보호</p>
                      <p className="text-xs text-muted-foreground">다운로드 시 비밀번호 요구</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPasswordInput(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    설정
                  </button>
                </div>
              </div>
            </div>

            {/* Upload Settings */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">업로드 설정</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <Upload className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">일괄 업로드</p>
                      <p className="text-xs text-muted-foreground">여러 파일 동시 업로드</p>
                    </div>
                  </div>
                  <Switch checked={bulkUploadMode} onCheckedChange={handleToggleBulkUpload} />
                </div>
              </div>
            </div>

            {/* Auto Delete Settings */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">자동 삭제</h4>
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{autoDeleteMinutes}분 후 자동 삭제</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={autoDeleteMinutes}
                  onChange={(e) => setAutoDeleteMinutes(Number(e.target.value))}
                  className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>1분</span>
                  <span>60분</span>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Right Sidebar - Statistics */}
      <Sheet open={rightDropdownOpen} onOpenChange={setRightDropdownOpen}>
        <button
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-gradient-to-l from-primary to-primary/80 text-primary-foreground p-3 rounded-l-2xl shadow-lg hover:shadow-xl transition-all"
          onClick={() => setRightDropdownOpen(!rightDropdownOpen)}
        >
          {rightDropdownOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <SheetContent side="right" className="w-[350px] sm:w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              파일 정보
            </SheetTitle>
            <SheetDescription>
              실시간 파일 업로드 및 다운로드 통계입니다.
            </SheetDescription>
          </SheetHeader>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 space-y-6"
          >
            {/* Real-time Statistics Section */}
            <div className="space-y-4 p-4 bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl border border-border/50">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                실시간 통계
              </h4>
              {uploadStats && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/30 rounded-lg"
                  >
                    <span className="text-sm text-muted-foreground">총 업로드</span>
                    <span className="font-bold text-primary">{uploadStats.totalUploads}</span>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/30 rounded-lg"
                  >
                    <span className="text-sm text-muted-foreground">오늘 업로드</span>
                    <span className="font-bold text-green-500">{uploadStats.uploadsToday}</span>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="flex justify-between items-center p-3 bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-950/30 rounded-lg"
                  >
                    <span className="text-sm text-muted-foreground">이번 시간</span>
                    <span className="font-bold text-orange-500">{uploadStats.uploadsThisHour}</span>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/30 rounded-lg"
                  >
                    <span className="text-sm text-muted-foreground">총 용량</span>
                    <span className="font-bold text-blue-500">{formatFileSize(uploadStats.totalSize)}</span>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/30 rounded-lg"
                  >
                    <span className="text-sm text-muted-foreground">총 다운로드</span>
                    <span className="font-bold text-purple-500">{uploadStats.totalDownloads}</span>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="flex justify-between items-center p-3 bg-gradient-to-r from-pink-50/50 to-transparent dark:from-pink-950/30 rounded-lg"
                  >
                    <span className="text-sm text-muted-foreground">활성 파일</span>
                    <span className="font-bold text-pink-500">{uploadStats.activeFiles}</span>
                  </motion.div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowStatsModal(true)}
                    className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl text-sm font-medium hover:shadow-lg transition-all"
                  >
                    상세 보기
                  </motion.button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </SheetContent>
      </Sheet>

      <header className="sticky top-0 z-50 bg-card border-b border-border backdrop-blur-sm bg-opacity-95">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Image
                  src="/deokyoung-logo.png"
                  alt="덕영고등학교 로고"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Dyhs File
                </h1>
                <p className="text-xs text-muted-foreground">share.dyhs.kr</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{autoDeleteMinutes}분 자동삭제</span>
              </div>
              <button
                onClick={toggleDarkMode}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              파일 공유 플랫폼
            </h2>
            <p className="text-muted-foreground">
              빠르고 안전한 파일 업로드 및 공유 서비스
            </p>
          </div>
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
                      className={`h-2 rounded-full transition-all duration-300 ${fileProgress.status === "error"
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
                    파일 선택하기
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground">업로드된 파일 ({uploadedFiles.length})</h3>
              <div className="flex items-center gap-3">
                {" "}
                {/* Combined search and batch delete */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="파일 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                {selectedFiles.size > 0 && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={batchDeleteFiles}
                    className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    선택 삭제 ({selectedFiles.size})
                  </motion.button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th key={header.id} className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-6 py-4">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {table.getRowModel().rows.length === 0 && ( // Updated empty state message
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    {searchQuery ? "검색 결과가 없습니다" : "업로드된 파일이 없습니다"}
                  </p>
                </div>
              )}
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
            <DialogDescription className="text-center text-muted-foreground">
              파일이 성공적으로 업로드되었습니다. 아래 링크를 복사하여 공유하세요.
            </DialogDescription>
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
    </div >
  )
}
