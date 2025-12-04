import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json()

    // 현재 메타데이터 가져오기
    const metadataResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/metadata`)
    const metadata = await metadataResponse.json()

    // 파일의 다운로드 카운트 증가
    const updatedFiles = metadata.files.map((file: any) =>
      file.id === fileId ? { ...file, downloadCount: file.downloadCount + 1 } : file,
    )

    // 전체 다운로드 수 증가
    const updatedMetadata = {
      ...metadata,
      files: updatedFiles,
      totalDownloads: metadata.totalDownloads + 1,
    }

    // 메타데이터 업데이트
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedMetadata),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update download count:", error)
    return NextResponse.json({ error: "Failed to update download count" }, { status: 500 })
  }
}
