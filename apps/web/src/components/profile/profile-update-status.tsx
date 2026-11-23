export function ProfileUpdateStatus({ status }: { status: 'success' | 'error' }) {
  return (
    <p role={status === 'error' ? 'alert' : 'status'} className={`alert alert--${status}`}>
      {status === 'success' ? 'Cập nhật thành công' : 'Cập nhật thất bại'}
    </p>
  );
}
