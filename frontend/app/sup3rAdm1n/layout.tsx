'use client';

import { SuperAuthProvider } from '@/lib/super-auth-context';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperAuthProvider>
      {children}
    </SuperAuthProvider>
  );
}
