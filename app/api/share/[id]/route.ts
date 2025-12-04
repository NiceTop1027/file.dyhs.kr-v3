import { type NextRequest, NextResponse } from "next/server"
import { getFileById } from "@/lib/file-storage"

function createContentDisposition(filename: string): string {
  // 파일 확장자 추출
  const lastDotIndex = filename.lastIndexOf(".")
  const extension = lastDotIndex !== -1 ? filename.substring(lastDotIndex) : ""

  // 간단한 ASCII 파일명 (확장자 포함)
  const asciiFilename = `file${extension}`

  // UTF-8 인코딩된 파일명 (RFC 5987)
  const encodedFilename = encodeURIComponent(filename)

  // 더 간단한 형태의 Content-Disposition 헤더
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
    const { id } = params
    console.log("[v0] Share API called with ID:", id)

    if (!id) {
      console.log("[v0] No ID provided")
      return NextResponse.json(
        { error: "파일 ID가 제공되지 않았습니다." },
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    const file = await getFileById(id)
    console.log("[v0] File retrieved:", file)

    if (!file) {
      console.log("[v0] File not found")
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다." },
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    const fileName = file.originalName || `file_${id}`
    const fileType = getMimeType(fileName, file.type)

    console.log("[v0] File details:", {
      originalName: file.originalName,
      fileName: fileName,
      fileType: fileType,
      url: file.url,
    })

    try {
      const response = await fetch(file.url)
      if (!response.ok) {
        throw new Error("Failed to fetch file")
      }

      const fileBuffer = await response.arrayBuffer()
      console.log("[v0] File buffer size:", fileBuffer.byteLength)

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": fileType,
          "Content-Disposition": createContentDisposition(fileName),
          "Content-Length": file.size.toString(),
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
          Pragma: "no-cache",
          Expires: "0",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      })
    } catch (fetchError) {
      console.error("[v0] Error fetching file:", fetchError)
      return NextResponse.json(
        { error: "파일 다운로드 중 오류가 발생했습니다." },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }
  } catch (error) {
    console.error("[v0] Share link error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
