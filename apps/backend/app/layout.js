import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'PayloadX API Studio — Collaborative API Testing Platform',
  description:
    'A production-ready, Postman-alternative API Testing Platform with real-time team collaboration built on Tauri + React + Next.js + MongoDB + Socket.IO.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
