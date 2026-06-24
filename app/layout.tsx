import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "天晴了绘图",
  description: "天晴了绘图 - AI 图片生成工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
