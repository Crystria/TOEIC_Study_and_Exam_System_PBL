'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { validateAvatarFile } from '@/lib/profile/validation';

export function useAvatarPreview() {
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const current = useRef<string | null>(null);
  const pending = useRef<string | null>(null);
  const version = useRef(0);
  const release = useCallback(() => {
    version.current++;
    if (current.current) URL.revokeObjectURL(current.current);
    if (pending.current) URL.revokeObjectURL(pending.current);
    current.current = null;
    pending.current = null;
  }, []);
  useEffect(() => release, [release]);
  const clear = useCallback(() => {
    release();
    setUrl(null);
    setName('');
    setError(null);
    setLoading(false);
  }, [release]);

  async function select(file: File): Promise<void> {
    const issue = validateAvatarFile(file);
    const requestVersion = ++version.current;
    if (pending.current) URL.revokeObjectURL(pending.current);
    pending.current = null;
    setError(issue);
    setLoading(false);
    if (issue) return;
    setLoading(true);
    let candidate: string | null = null;
    try {
      candidate = URL.createObjectURL(file);
      pending.current = candidate;
      const image = new Image();
      image.src = candidate;
      await image.decode();
      if (requestVersion !== version.current) {
        URL.revokeObjectURL(candidate);
        return;
      }
      if (current.current) URL.revokeObjectURL(current.current);
      current.current = candidate;
      pending.current = null;
      setUrl(candidate);
      setName(file.name);
    } catch {
      if (candidate) URL.revokeObjectURL(candidate);
      if (requestVersion === version.current) {
        pending.current = null;
        setError('Không đọc được ảnh. Vui lòng chọn lại một tệp ảnh hợp lệ.');
      }
    } finally {
      if (requestVersion === version.current) setLoading(false);
    }
  }
  return { url, name, error, loading, select, clear };
}
