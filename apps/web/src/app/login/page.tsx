'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // TODO: Integrate with backend auth API
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Call login API
  };

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-6 text-center text-2xl font-bold">Đăng nhập</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-brand px-4 py-2 text-white hover:bg-brand-dark"
        >
          Đăng nhập
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="text-brand hover:underline">
          Đăng ký
        </Link>
      </p>
    </div>
  );
}
