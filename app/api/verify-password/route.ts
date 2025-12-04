import { type NextRequest, NextResponse } from "next/server"
import { getFileById, verifyFilePassword } from "@/lib/file-storage"

export async function POST(request: NextRequest) {
  try {
    const { fileId, password } = await request.json()

    if (!fileId || !password) {
      return NextResponse.json({ error: "파일 ID와 비밀번호가 필요합니다." }, { status: 400 })
    }

    const file = await getFileById(fileId)

    if (!file) {
      return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 })
    }

    const isValid = await verifyFilePassword(file, password)

    if (isValid) {
      return NextResponse.json({
        success: true,
        message: "비밀번호가 확인되었습니다.",
      })
    } else {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    return NextResponse.json({
      error: "비밀번호 확인 중 오류가 발생했습니다.",
      details: errorMessage
    }, { status: 500 })
  }
}
