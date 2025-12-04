import { NextResponse } from "next/server"

export async function POST() {
  try {
    // 현재 메타데이터 가져오기
    const metadataResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/metadata`)
    const metadata = await metadataResponse.json()

    // 방문자 수 증가
    const updatedMetadata = {
      ...metadata,
      totalVisitors: metadata.totalVisitors + 1,
      dailyVisitors: metadata.dailyVisitors + 1,
    }

    // 메타데이터 업데이트
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedMetadata),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to increment visitor count:", error)
    return NextResponse.json({ error: "Failed to increment visitor count" }, { status: 500 })
  }
}
