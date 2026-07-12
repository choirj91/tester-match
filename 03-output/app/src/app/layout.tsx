import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FloatButtons } from "@/components/kakao-float-button";
import { PageTracker } from "@/components/page-tracker";

const ADSENSE_CLIENT = "ca-pub-6738372737459853";

export const metadata: Metadata = {
  title: {
    default: "Tester Match — Google Play 비공개 테스트 12명을 7일 안에",
    template: "%s | Tester Match",
  },
  description:
    "Google Play Closed Testing 12명/14일 요건을 한국 인디 개발자끼리 품앗이로 해결하는 무료 매칭 플랫폼. 안드로이드 앱 출시 전 필수 요건을 서로 도와 완주하세요.",
  keywords: [
    "구글 플레이 비공개 테스트",
    "안드로이드 테스터 모집",
    "Google Play Closed Testing",
    "테스터 품앗이",
    "12명 14일",
    "앱 출시 요건",
    "인디 개발자",
    "Tester Match",
    "테스터 매치",
    "안드로이드 앱 테스트",
  ],
  metadataBase: new URL("https://tester-match.pages.dev"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "Tester Match",
    url: "https://tester-match.pages.dev",
    title: "Tester Match — Google Play 비공개 테스트 12명을 7일 안에",
    description:
      "Google Play Closed Testing 12명/14일 요건을 인디 개발자끼리 품앗이로 해결하는 무료 매칭 플랫폼.",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Tester Match — 안드로이드 비공개 테스터 매칭",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tester Match — Google Play 비공개 테스트 12명을 7일 안에",
    description:
      "안드로이드 테스터 12명/14일 요건을 인디 개발자끼리 품앗이로 완주하세요.",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  verification: {
    google: undefined, // AdSense 확인은 head meta 로 처리
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
        <meta name="google-adsense-account" content={ADSENSE_CLIENT} />
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-white text-neutral-900 antialiased">
        {children}
        <FloatButtons />
        <PageTracker />
      </body>
    </html>
  );
}
