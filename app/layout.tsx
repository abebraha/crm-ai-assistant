import type { Metadata } from 'next';
import AuthProvider from '@/components/AuthProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRM AI Assistant',
  description: 'Update any CRM by chat or voice — powered by AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
