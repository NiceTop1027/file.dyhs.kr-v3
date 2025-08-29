import { type NextRequest, NextResponse } from "next/server"
import { getFileById } from "@/lib/file-storage"

function convertKoreanToEnglish(text: string): string {
  // 한글 자모 매핑 테이블
  const consonants: Record<string, string> = {
    ㄱ: "g",
    ㄲ: "kk",
    ㄴ: "n",
    ㄷ: "d",
    ㄸ: "tt",
    ㄹ: "r",
    ㅁ: "m",
    ㅂ: "b",
    ㅃ: "pp",
    ㅅ: "s",
    ㅆ: "ss",
    ㅇ: "",
    ㅈ: "j",
    ㅉ: "jj",
    ㅊ: "ch",
    ㅋ: "k",
    ㅌ: "t",
    ㅍ: "p",
    ㅎ: "h",
  }

  const vowels: Record<string, string> = {
    ㅏ: "a",
    ㅐ: "ae",
    ㅑ: "ya",
    ㅒ: "yae",
    ㅓ: "eo",
    ㅔ: "e",
    ㅕ: "yeo",
    ㅖ: "ye",
    ㅗ: "o",
    ㅘ: "wa",
    ㅙ: "wae",
    ㅚ: "oe",
    ㅛ: "yo",
    ㅜ: "u",
    ㅝ: "wo",
    ㅞ: "we",
    ㅟ: "wi",
    ㅠ: "yu",
    ㅡ: "eu",
    ㅢ: "ui",
    ㅣ: "i",
  }

  const finalConsonants: Record<string, string> = {
    ㄱ: "k",
    ㄲ: "k",
    ㄳ: "ks",
    ㄴ: "n",
    ㄵ: "nj",
    ㄶ: "nh",
    ㄷ: "t",
    ㄹ: "l",
    ㄺ: "lg",
    ㄻ: "lm",
    ㄼ: "lb",
    ㄽ: "ls",
    ㄾ: "lt",
    ㄿ: "lp",
    ㅀ: "lh",
    ㅁ: "m",
    ㅂ: "p",
    ㅄ: "ps",
    ㅅ: "t",
    ㅆ: "t",
    ㅇ: "ng",
    ㅈ: "t",
    ㅊ: "t",
    ㅋ: "k",
    ㅌ: "t",
    ㅍ: "p",
    ㅎ: "t",
  }

  let result = ""

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const code = char.charCodeAt(0)

    // 한글 완성형 문자인지 확인 (가-힣)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const base = code - 0xac00
      const initial = Math.floor(base / 588)
      const medial = Math.floor((base % 588) / 28)
      const final = base % 28

      const initialKeys = Object.keys(consonants)
      const medialKeys = Object.keys(vowels)
      const finalKeys = ["", ...Object.keys(finalConsonants)]

      result += consonants[initialKeys[initial]] || ""
      result += vowels[medialKeys[medial]] || ""
      if (final > 0) {
        result += finalConsonants[finalKeys[final]] || ""
      }
    } else {
      // 한글이 아닌 문자는 그대로 유지
      result += char
    }
  }

  return result
}

function createContentDisposition(filename: string): string {
  const convertedFilename = convertKoreanToEnglish(filename)

  // 파일 확장자 추출
  const lastDotIndex = convertedFilename.lastIndexOf(".")
  const extension = lastDotIndex !== -1 ? convertedFilename.substring(lastDotIndex) : ""
  const nameWithoutExt = lastDotIndex !== -1 ? convertedFilename.substring(0, lastDotIndex) : convertedFilename

  // 영어로 변환된 파일명 사용 (특수문자 제거 및 공백을 언더스코어로 변환)
  const cleanName =
    nameWithoutExt
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "file"
  const finalFilename = `${cleanName}${extension}`

  // 간단한 Content-Disposition 헤더 (영어 파일명만 사용)
  return `attachment; filename="${finalFilename}"`
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
      return new NextResponse("File not found", { status: 404 })
    }

    // Fetch the file from Firebase Storage
    const response = await fetch(file.url)

    if (!response.ok) {
      return new NextResponse("Failed to fetch file", { status: 500 })
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
    console.error("Download error:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
