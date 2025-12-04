import { type NextRequest, NextResponse } from "next/server"
import { getFileById } from "@/lib/file-storage"

function createContentDisposition(filename: string): string {
  // 파일 확장자 추출
  const lastDotIndex = filename.lastIndexOf(".")
  const extension = lastDotIndex !== -1 ? filename.substring(lastDotIndex) : ""

  // 간단한 ASCII 파일명 (확장자 포함) - 폴백용
  const asciiFilename = `file${extension}`

  // UTF-8 인코딩된 파일명 (RFC 5987)
  const encodedFilename = encodeURIComponent(filename)

  // RFC 5987 형식의 Content-Disposition 헤더 (한글 파일명 보존)
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`
}

function getMimeType(filename: string, originalType?: string): string {
  if (originalType && originalType !== "application/octet-stream") {
    return originalType
  }

  const ext = filename.toLowerCase().split(".").pop()
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  }

  return mimeTypes[ext || ""] || "application/octet-stream"
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const fileId = params.id
    const file = await getFileById(fileId)

    if (!file) {
      return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 })
    }

    // Fetch the file from Firebase Storage
    const response = await fetch(file.url)

    if (!response.ok) {
      return new NextResponse("파일을 가져올 수 없습니다.", { status: 500 })
    }

    const blob = await response.blob()
    const downloadName = file.originalName || file.filename || file.id

    const mimeType = getMimeType(downloadName, file.type)

    return new NextResponse(blob, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": createContentDisposition(downloadName),
        "Content-Length": blob.size.toString(),
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    return new NextResponse(`파일 다운로드 중 오류가 발생했습니다: ${errorMessage}`, { status: 500 })
  }
}
