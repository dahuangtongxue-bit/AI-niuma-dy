import './globals.css';

export const metadata = {
  title: '数字员工 · 阿抖｜抖音运营专员',
  description: '每天交付 3 个能直接开拍的抖音剧本包：Hook 定稿、分镜表、字卡、质检报告。',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.loli.net" />
        <link rel="preconnect" href="https://gstatic.loli.net" crossOrigin="anonymous" />
        <link
          href="https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
