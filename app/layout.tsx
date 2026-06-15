import type { Metadata } from 'next';
import './globals.css';
import { auth } from '@/auth';
import { SessionProvider } from 'next-auth/react';
import { TopNav } from '@/components/top-nav';

export const metadata: Metadata = {
  title: 'Task Tracker',
  description: 'Cross-project task and calendar dashboard',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const showNav = !!session?.user;

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full">
        <SessionProvider session={session}>
          {showNav && (
            <TopNav
              userName={session.user?.name}
              userEmail={session.user?.email}
              userImage={session.user?.image}
            />
          )}
          <main>{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
