import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const fileMetadata = await request.json()

    // 현재 메타데이터 가져오기
    const metadataResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/metadata`)
    const metadata = await metadataResponse.json()

    // 파일 추가
    const updatedFiles = [...metadata.files, fileMetadata]

    // 메타데이터 업데이트
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...metadata, files: updatedFiles }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to save file metadata:", error)
    return NextResponse.json({ error: "Failed to save file metadata" }, { status: 500 })
  }
}
