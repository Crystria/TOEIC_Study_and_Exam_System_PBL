export interface AuthFormValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export type AuthIntent = 'login' | 'register';
export type AuthErrors = Partial<Record<keyof AuthFormValues, string>>;

export function validateAuth(values: AuthFormValues, intent: AuthIntent): AuthErrors {
  const errors: AuthErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 320)
    errors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (!values.password) errors.password = 'Vui lòng nhập mật khẩu.';
  if (intent === 'register') {
    if (values.fullName.trim().length < 2) errors.fullName = 'Họ tên cần có ít nhất 2 ký tự.';
    if (
      values.password.length < 8 ||
      !/[A-Z]/.test(values.password) ||
      !/[a-z]/.test(values.password) ||
      !/[0-9]/.test(values.password)
    )
      errors.password = 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.';
    if (!values.confirmPassword || values.confirmPassword !== values.password)
      errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
  }
  return errors;
}

// Preview only: no account creation, tokens, credential storage or API requests.
export async function submitAuthPreview(intent: AuthIntent): Promise<string> {
  await new Promise<void>((resolve) => setTimeout(resolve, 300));
  return intent === 'login'
    ? 'Thông tin đã hợp lệ. Đăng nhập tài khoản chưa được bật trong bản xem trước. Bạn có thể chọn “Xem thử không gian học tập” bên dưới.'
    : 'Thông tin đã hợp lệ. Bản xem trước chưa tạo tài khoản hoặc gửi email kích hoạt. Bạn có thể xem thử không gian học tập ngay bên dưới.';
}
