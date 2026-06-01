import './globals.css';
import type { Metadata } from 'next';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'ระบบใบเทียบโอนรายวิชา',
  description: 'ตารางการเทียบวิชาเรียนและโอนหน่วยกิต',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
