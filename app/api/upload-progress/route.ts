import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    // 이 엔드포인트는 실제로는 사용되지 않지만
    // XMLHttpRequest의 progress 이벤트를 위해 필요합니다
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Upload progress tracking failed" }, { status: 500 })
  }
}
