import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from './context/AuthContext';
import { PrivacyProvider } from './context/PrivacyContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Personal Finance - Portfolio Intelligence',
  description: 'PDF-first portfolio tracking with AI suggestions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} text-white min-h-screen`}>
        <AuthProvider>
          <PrivacyProvider>
            {children}
          </PrivacyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
