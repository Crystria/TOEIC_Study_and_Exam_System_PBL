'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // TODO: Integrate with backend auth API
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Call register API
  };

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-6 text-center text-2xl font-bold">Đăng ký</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Họ tên</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none"
            placeholder="Nguyễn Văn A"
          />
        </div>
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
        <div>
          <label className="block text-sm font-medium text-slate-700">Xác nhận mật khẩu</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-brand px-4 py-2 text-white hover:bg-brand-dark"
        >
          Đăng ký
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Đã có tài khoản?{' '}
        <Link href="/login" className="text-brand hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
