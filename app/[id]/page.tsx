"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Download, FileText, ArrowLeft, Copy, Check, Lock, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { type FileMetadata, getFileById, updateDownloadCount, verifyFilePassword } from "@/lib/file-storage"
import Image from "next/image"

export default function DirectSharePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [file, setFile] = useState<FileMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [passwordVerified, setPasswordVerified] = useState(false)
  const [verifyingPassword, setVerifyingPassword] = useState(false)

  useEffect(() => {
    const fileId = params.id as string
    if (fileId) {
      const fetchFile = async () => {
        const fileData = await getFileById(fileId)
        if (fileData) {
          setFile(fileData)
          setLoading(false)

          if (fileData.passwordProtected) {
            setShowPasswordInput(true)
            return
          }

          // Auto download for non-protected files
          setTimeout(async () => {
            try {
              if (typeof window === "undefined") {
                console.log("[v0] Skipping auto download - not in browser environment")
                return
              }

              const downloadName = fileData.originalName || fileData.filename || fileData.id
              console.log("[v0] Starting auto download for:", downloadName)
              console.log("[v0] File data:", fileData)

              const downloadUrl = `/api/download/${fileData.id}`

              const link = document.createElement("a")
              link.href = downloadUrl
              link.download = downloadName
              link.style.display = "none"
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)

              updateDownloadCount(fileData.id)
              console.log("[v0] Auto download completed successfully")
            } catch (error) {
              console.error("Auto download failed:", error)
            }
          }, 1000)
        } else {
          setFile(null)
          setLoading(false)
        }
      }

      fetchFile()
    }
  }, [params.id])

  const handlePasswordSubmit = async () => {
    if (!file || !password) {
      toast({
        title: "비밀번호 입력",
        description: "비밀번호를 입력해주세요.",
        variant: "destructive",
      })
      return
    }

    setVerifyingPassword(true)

    try {
      const isValid = await verifyFilePassword(file, password)

      if (isValid) {
        setPasswordVerified(true)
        setShowPasswordInput(false)
        toast({
          title: "인증 성공",
          description: "비밀번호가 확인되었습니다. 파일에 접근할 수 있습니다.",
        })

        // Auto download after password verification
        setTimeout(() => {
          handleManualDownload()
        }, 1000)
      } else {
        toast({
          title: "인증 실패",
          description: "비밀번호가 올바르지 않습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "오류 발생",
        description: "비밀번호 확인 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setVerifyingPassword(false)
    }
  }

  const handleManualDownload = async () => {
    if (file) {
      if (file.passwordProtected && !passwordVerified) {
        setShowPasswordInput(true)
        return
      }

      try {
        const downloadName = file.originalName || file.filename || file.id

        const downloadUrl = `/api/download/${file.id}`

        const link = document.createElement("a")
        link.href = downloadUrl
        link.download = downloadName
        link.style.display = "none"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        updateDownloadCount(file.id)
        toast({
          title: "다운로드 시작",
          description: `${downloadName} 파일이 다운로드되었습니다.`,
        })
      } catch (error) {
        console.error("Download failed:", error)
        toast({
          title: "다운로드 실패",
          description: "파일 다운로드 중 오류가 발생했습니다.",
          variant: "destructive",
        })
      }
    }
  }

  const copyShareLink = async () => {
    try {
      if (typeof window === "undefined") {
        toast({
          title: "오류",
          description: "링크 복사 기능을 사용할 수 없습니다.",
          variant: "destructive",
        })
        return
      }

      const shareUrl = window.location.href
      await navigator.clipboard.writeText(shareUrl)

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      toast({
        title: "링크 복사됨",
        description: "공유 링크가 클립보드에 복사되었습니다.",
      })
    } catch (error) {
      if (typeof window === "undefined") {
        toast({
          title: "오류",
          description: "링크 복사 기능을 사용할 수 없습니다.",
          variant: "destructive",
        })
        return
      }

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
    if (bytes === 0) return "크기 정보 없음"
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
          <p className="text-gray-600">파일 다운로드 중...</p>
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

  if (showPasswordInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <Card className="max-w-md mx-auto shadow-xl border-0 bg-white/80 backdrop-blur-sm relative z-10">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 rounded-2xl bg-orange-100">
                <Lock className="h-10 w-10 text-orange-600" />
              </div>
            </div>
            <CardTitle className="text-xl">비밀번호가 필요합니다</CardTitle>
            <CardDescription>이 파일은 비밀번호로 보호되어 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="pr-10"
                  onKeyPress={(e) => e.key === "Enter" && handlePasswordSubmit()}
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
              <Button variant="outline" onClick={() => router.push("/")} className="flex-1">
                취소
              </Button>
              <Button
                onClick={handlePasswordSubmit}
                disabled={verifyingPassword || !password}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {verifyingPassword ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    확인 중...
                  </div>
                ) : (
                  "확인"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

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
            <p className="text-xl text-gray-600">share.dyhs.kr에서 공유된 파일입니다</p>
          </div>

          <Card className="mb-8 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-blue-100">
                  <FileText className="h-10 w-10 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-800">{file.originalName || file.filename}</p>
                  <p className="text-gray-600 font-normal">
                    {formatFileSize(file.size)} • {file.type}
                    {file.passwordProtected && (
                      <span className="ml-2 inline-flex items-center gap-1 text-orange-600">
                        <Lock className="h-3 w-3" />
                        보호됨
                      </span>
                    )}
                  </p>
                </div>
              </CardTitle>
              <CardDescription className="text-base mt-2">
                업로드됨:{" "}
                {new Date(file.uploadedAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center justify-center gap-2 text-blue-700 mb-2">
                  <Download className="h-5 w-5" />
                  <span className="font-medium">파일이 준비되었습니다!</span>
                </div>
                <p className="text-sm text-blue-600">아래 버튼을 클릭하여 파일을 다운로드하세요.</p>
              </div>

              <div className="flex gap-4 mt-4">
                <Button
                  onClick={handleManualDownload}
                  className="flex-1 flex items-center justify-center gap-3 rounded-xl py-6 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200 bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  <Download className="h-5 w-5" />
                  수동 다운로드
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
