'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSettings } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getSettings()
      .then((data) => {
        if (data.user_name) {
          router.push('/dashboard');
        } else {
          router.push('/welcome');
        }
      })
      .catch(() => router.push('/welcome'))
      .finally(() => setChecking(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="animate-pulse text-gray-400">Loading...</div>
    </div>
  );
}
