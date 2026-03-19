'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSeries } from '@/lib/series';

export default function SeriesIndexPage() {
  const router = useRouter();

  useEffect(() => {
    const all = getSeries();
    if (all.length === 0) {
      router.replace('/series/new');
    } else {
      router.replace(`/series/${all[0].id}`);
    }
  }, [router]);

  return null;
}
