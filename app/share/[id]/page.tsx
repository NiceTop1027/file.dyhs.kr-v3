"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Download, FileText, ArrowLeft, Copy, Check, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  type FileMetadata,
  getFileById,
  updateDownloadCount,
  getTimeUntilExpiry,
  formatExpiryTime,
} from "@/lib/file-storage"
import Image from "next/image"

export default function SharePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [file, setFile] = useState<FileMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [autoDownloadStarted, setAutoDownloadStarted] = useState(false)

  useEffect(() => {
    const loadFile = async () => {
      const fileId = params.id as string
      console.log("[v0] Share page loading file with ID:", fileId)

      if (fileId) {
        try {
          const fileData = await getFileById(fileId)
          console.log("[v0] File data retrieved:", fileData)
          setFile(fileData)
          setLoading(false)

          if (fileData && !autoDownloadStarted) {
            setAutoDownloadStarted(true)
            setTimeout(() => {
              handleAutoDownload(fileData)
            }, 1000) // 1초 후 자동 다운로드
          }
        } catch (error) {
          console.error("[v0] Failed to load file:", error)
          setFile(null)
          setLoading(false)
        }
      }
    }

    loadFile()
  }, [params.id, autoDownloadStarted])

  const handleAutoDownload = async (fileData: FileMetadata) => {
    console.log("[v0] Starting auto download for file:", {
      id: fileData.id,
      originalName: fileData.originalName,
      url: fileData.url,
    })

    try {
      await updateDownloadCount(fileData.id)

      const safeFileName =
        fileData.originalName && fileData.originalName.trim() !== ""
          ? fileData.originalName
          : `file_${fileData.id}.${getFileExtension(fileData.type)}`

      console.log("[v0] Auto downloading with filename:", safeFileName)

      const link = document.createElement("a")
      link.href = fileData.url
      link.download = safeFileName
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "자동 다운로드 시작",
        description: `${safeFileName} 파일이 자동으로 다운로드되었습니다.`,
      })
    } catch (error) {
      console.error("[v0] Auto download failed:", error)
      toast({
        title: "자동 다운로드 실패",
        description: "수동으로 다운로드 버튼을 클릭해주세요.",
        variant: "destructive",
      })
    }
  }

  const handleManualDownload = async () => {
    if (file) {
      console.log("[v0] Starting manual download for file:", {
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        type: file.type,
        url: file.url,
      })

      try {
        await updateDownloadCount(file.id)

        const safeFileName =
          file.originalName && file.originalName.trim() !== ""
            ? file.originalName
            : `file_${file.id}.${getFileExtension(file.type)}`

        console.log("[v0] Manual downloading with filename:", safeFileName)

        const link = document.createElement("a")
        link.href = file.url
        link.download = safeFileName
        link.target = "_blank"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast({
          title: "다운로드 시작",
          description: `${safeFileName} 파일이 다운로드되었습니다.`,
        })
      } catch (error) {
        console.error("[v0] Failed to download file:", error)
        toast({
          title: "다운로드 실패",
          description: "파일 다운로드 중 오류가 발생했습니다.",
          variant: "destructive",
        })
      }
    } else {
      console.error("[v0] No file data available for download")
    }
  }

  const getFileExtension = (mimeType: string): string => {
    const extensions: { [key: string]: string } = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "text/plain": "txt",
      "text/html": "html",
      "application/pdf": "pdf",
      "application/zip": "zip",
      "application/json": "json",
      "video/mp4": "mp4",
      "audio/mpeg": "mp3",
    }

    return extensions[mimeType] || "bin"
  }

  const copyShareLink = async () => {
    try {
      const shareUrl = window.location.href
      await navigator.clipboard.writeText(shareUrl)

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      toast({
        title: "링크 복사됨",
        description: "공유 링크가 클립보드에 복사되었습니다.",
      })
    } catch (error) {
      const textArea = document.createElement("textarea")
      textArea.value = window.location.href
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      toast({
        title: "링크 복사됨",
        description: "공유 링크가 클립보드에 복사되었습니다.",
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">파일 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!file) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
        <Card className="max-w-md mx-auto shadow-xl border-0 bg-white/80 backdrop-blur-sm relative z-10">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600 text-xl">파일을 찾을 수 없습니다</CardTitle>
            <CardDescription>요청하신 파일이 존재하지 않거나 삭제되었습니다.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const timeUntilExpiry = getTimeUntilExpiry(file.expiresAt)
  const isExpiringSoon = timeUntilExpiry < 60000

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Image
                src="/deokyoung-logo.png"
                alt="덕영고등학교 로고"
                width={60}
                height={60}
                className="animate-pulse"
              />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                파일 다운로드
              </h1>
            </div>
            <p className="text-xl text-gray-600">file.dyhs.kr에서 공유된 파일입니다</p>
          </div>

          <Card className="mb-8 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-blue-100">
                  <FileText className="h-10 w-10 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-800">{file.originalName}</p>
                  <p className="text-gray-600 font-normal">
                    {formatFileSize(file.size)} • {file.type}
                  </p>
                </div>
              </CardTitle>
              <CardDescription className="text-base mt-2">
                <div className="flex items-center justify-between">
                  <span>
                    업로드됨:{" "}
                    {new Date(file.uploadedAt).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <div className={`flex items-center gap-1 ${isExpiringSoon ? "text-red-600" : "text-blue-600"}`}>
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">{formatExpiryTime(timeUntilExpiry)}</span>
                  </div>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center justify-center gap-2 text-blue-700 mb-2">
                  <Download className="h-5 w-5" />
                  <span className="font-medium">
                    {autoDownloadStarted ? "자동 다운로드가 시작되었습니다!" : "파일이 준비되었습니다!"}
                  </span>
                </div>
                <p className="text-sm text-blue-600">
                  {autoDownloadStarted
                    ? "다운로드가 시작되지 않았다면 아래 버튼을 클릭하세요."
                    : "아래 버튼을 클릭하여 파일을 다운로드하세요."}
                </p>
              </div>

              <div className="flex gap-4 mt-4">
                <Button
                  onClick={handleManualDownload}
                  className="flex-1 flex items-center justify-center gap-3 rounded-xl py-6 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200 bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  <Download className="h-5 w-5" />
                  파일 다운로드
                </Button>
                <Button
                  variant="outline"
                  onClick={copyShareLink}
                  className="flex items-center gap-2 rounded-xl border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 px-6 bg-transparent"
                  size="lg"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-blue-600" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      링크 복사
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="flex items-center gap-2 rounded-xl hover:bg-blue-100 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />새 파일 업로드하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
