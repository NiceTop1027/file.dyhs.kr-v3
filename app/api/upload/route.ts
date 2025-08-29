import { type NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"

let adminStorage: any = null
let adminStorageError: string | null = null

try {
  console.log("[v0] Importing Firebase Admin SDK...")
  const { adminStorage: storage } = await import("@/lib/firebase/admin")
  adminStorage = storage
  console.log("[v0] Firebase Admin SDK imported successfully")
} catch (error) {
  console.error("[v0] Failed to import Firebase Admin SDK:", error)
  adminStorageError = error.message
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
  console.log("[v0] Upload API called")

  if (!adminStorage) {
    console.error("[v0] Firebase Admin SDK not available:", adminStorageError)
    return NextResponse.json(
      { error: "Server configuration error", details: adminStorageError },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    )
  }

  try {
    console.log("[v0] Parsing form data...")
    const formData = await request.formData()
    const file = formData.get("file") as File
    const securityMode = formData.get("securityMode") === "true"
    const userId = (formData.get("userId") as string) || generateSessionId()

    console.log("[v0] File info:", {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      userId: userId,
    })

    if (!file) {
      console.log("[v0] No file provided in request")
      return NextResponse.json(
        { error: "No file provided" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        },
      )
    }

    const fileId = generateFileId()
    const fileExtension = file.name.split(".").pop()
    const uniqueFileName = `${fileId}.${fileExtension}`

    console.log("[v0] Generated file ID:", fileId, "Unique filename:", uniqueFileName)

    console.log("[v0] Uploading file to Firebase Storage...")
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

    console.log("[v0] File uploaded successfully. Firebase Storage URL:", publicUrl)

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

    console.log("[v0] Returning metadata to client for Firestore storage...")

    return NextResponse.json(
      {
        ...metadata,
        shareUrl: `https://file.dyhs.kr/${fileId}`,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  } catch (error) {
    console.error("[v0] Upload error:", error)
    console.error("[v0] Error details:", error.message, error.stack)
    return NextResponse.json(
      { error: "Upload failed", details: error.message },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    )
  }
}
