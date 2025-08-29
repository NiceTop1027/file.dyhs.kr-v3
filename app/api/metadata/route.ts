import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

const METADATA_FILE = "global-metadata.json"

interface GlobalMetadata {
  files: any[]
  totalVisitors: number
  dailyVisitors: number
  lastVisitorReset: string
  totalDownloads: number
}

export async function GET() {
  try {
    // Vercel Blob에서 메타데이터 파일 가져오기
    const response = await fetch(`${process.env.BLOB_READ_WRITE_TOKEN}/${METADATA_FILE}`)

    if (response.ok) {
      const metadata = await response.json()

      // 일일 방문자 수 리셋 확인
      const today = new Date().toDateString()
      if (metadata.lastVisitorReset !== today) {
        metadata.dailyVisitors = 0
        metadata.lastVisitorReset = today

        // 업데이트된 메타데이터 저장
        await put(METADATA_FILE, JSON.stringify(metadata), {
          access: "public",
          contentType: "application/json",
        })
      }

      return NextResponse.json(metadata)
    }
  } catch (error) {
    console.error("Failed to get metadata:", error)
  }

  // 기본 메타데이터 반환
  const defaultMetadata: GlobalMetadata = {
    files: [],
    totalVisitors: 0,
    dailyVisitors: 0,
    lastVisitorReset: new Date().toDateString(),
    totalDownloads: 0,
  }

  return NextResponse.json(defaultMetadata)
}

export async function POST(request: NextRequest) {
  try {
    const updates = await request.json()

    // 현재 메타데이터 가져오기
    let currentMetadata: GlobalMetadata
    try {
      const response = await fetch(`${process.env.BLOB_READ_WRITE_TOKEN}/${METADATA_FILE}`)
      currentMetadata = response.ok
        ? await response.json()
        : {
            files: [],
            totalVisitors: 0,
            dailyVisitors: 0,
            lastVisitorReset: new Date().toDateString(),
            totalDownloads: 0,
          }
    } catch {
      currentMetadata = {
        files: [],
        totalVisitors: 0,
        dailyVisitors: 0,
        lastVisitorReset: new Date().toDateString(),
        totalDownloads: 0,
      }
    }

    // 메타데이터 업데이트
    const updatedMetadata = { ...currentMetadata, ...updates }

    // Vercel Blob에 저장
    await put(METADATA_FILE, JSON.stringify(updatedMetadata), {
      access: "public",
      contentType: "application/json",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update metadata:", error)
    return NextResponse.json({ error: "Failed to update metadata" }, { status: 500 })
  }
}
