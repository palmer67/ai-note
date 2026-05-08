import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Notes",
  description: "保存优质文章，轻量标记，让 AI 帮你拆解成真正可复用的学习笔记。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
