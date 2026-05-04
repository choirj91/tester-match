import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tester Match — Google Play 비공개 테스트 12명을 7일 안에",
    template: "%s | Tester Match",
  },
  description:
    "Google Play Closed Testing 12명/14일 요건을 한국 인디 개발자끼리 품앗이로 해결하는 매칭 플랫폼.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "Tester Match",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
