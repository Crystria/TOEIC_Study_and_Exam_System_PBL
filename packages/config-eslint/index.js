/**
 * Preset ESLint dùng chung cho monorepo (flat config).
 * Các package/service có thể import và mở rộng.
 */
export const ignores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.venv/**',
  '**/.dart_tool/**',
];

export default { ignores };
