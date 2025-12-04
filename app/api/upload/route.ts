import { type NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

let adminStorage: any = null
let adminStorageError: string | null = null

try {
  const { adminStorage: storage } = await import("@/lib/firebase/admin")
  adminStorage = storage
} catch (error) {
  adminStorageError = error instanceof Error ? error.message : String(error)
}

function generateFileId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""

  const array = randomBytes(4)

  for (let i = 0; i < 4; i++) {
    result += chars[array[i] % chars.length]
  }

  return result
}

function generateSessionId(): string {
  return randomBytes(8).toString("hex")
}

const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB
const ALLOWED_MIME_TYPES = new Set([
  'image/', 'video/', 'audio/', 'application/pdf',
  'application/zip', 'application/x-rar-compressed',
  'text/', 'application/json', 'application/msword',
  'application/vnd.openxmlformats-officedocument'
])

function isAllowedFileType(mimeType: string): boolean {
  return Array.from(ALLOWED_MIME_TYPES).some(allowed => mimeType.startsWith(allowed))
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

export async function POST(request: NextRequest) {
  // 속도 제한 체크
  const clientIp = getClientIp(request)
  const rateLimitResult = checkRateLimit(clientIp, { max: 20, windowMs: 60000 })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.",
        retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(rateLimitResult.reset).toISOString(),
          "Retry-After": Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  if (!adminStorage) {
    return NextResponse.json(
      { error: "서버 설정 오류가 발생했습니다.", details: adminStorageError },
      { status: 500 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const securityMode = formData.get("securityMode") === "true"
    const userId = (formData.get("userId") as string) || generateSessionId()

    // 입력 검증
    if (!file) {
      return NextResponse.json(
        { error: "파일이 제공되지 않았습니다." },
        { status: 400 }
      )
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기가 1GB를 초과합니다." },
        { status: 400 }
      )
    }

    // 파일 타입 검증
    if (!isAllowedFileType(file.type)) {
      return NextResponse.json(
        { error: "허용되지 않는 파일 형식입니다." },
        { status: 400 }
      )
    }

    const fileId = generateFileId()
    const fileExtension = file.name.split(".").pop()
    const uniqueFileName = `${fileId}.${fileExtension}`

    const bucket = adminStorage.bucket()
    const fileRef = bucket.file(`files/${uniqueFileName}`)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          originalName: file.name,
          uploadedBy: userId,
        },
      },
    })

    await fileRef.makePublic()
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/files/${uniqueFileName}`

    const metadata = {
      id: fileId,
      filename: uniqueFileName,
      originalName: file.name,
      size: file.size,
      type: file.type,
      url: publicUrl,
      uploadedAt: new Date().toISOString(),
      downloadCount: 0,
      userId: userId,
      securityMode: securityMode,
    }

    return NextResponse.json(
      {
        ...metadata,
        shareUrl: `https://share.dyhs.kr/${fileId}`,
      },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimitResult.reset).toISOString(),
        },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    return NextResponse.json(
      { error: "파일 업로드 중 오류가 발생했습니다.", details: errorMessage },
      { status: 500 }
    )
  }
}
