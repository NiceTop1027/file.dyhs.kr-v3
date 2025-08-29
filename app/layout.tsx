import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"

export const metadata: Metadata = {
  title: "Dukyoung File",
  description: "덕영고등학교 파일 공유 플랫폼 - 안전하고 빠른 파일 업로드 및 공유 서비스",
  generator: "v0.app",
  icons: {
    icon: "/deokyoung-logo.png",
    shortcut: "/deokyoung-logo.png",
    apple: "/deokyoung-logo.png",
  },
  openGraph: {
    title: "Dukyoung File",
    description: "덕영고등학교 파일 공유 플랫폼 - 안전하고 빠른 파일 업로드 및 공유 서비스",
    url: "https://file.dyhs.kr",
    siteName: "Dukyoung File",
    images: [
      {
        url: "/deokyoung-logo.png",
        width: 800,
        height: 600,
        alt: "Dukyoung File Logo",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dukyoung File",
    description: "덕영고등학교 파일 공유 플랫폼 - 안전하고 빠른 파일 업로드 및 공유 서비스",
    images: ["/deokyoung-logo.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
