import { failureMessage, GatewayError } from '../../../../web/src/lib/integration/client';

/** Accept the direct service error and the same error wrapped by the frontend bridge. */
export function topicErrorMessage(error: unknown): string {
  if (error instanceof GatewayError && error.details && typeof error.details === 'object') {
    const envelope = error.details;
    const payload =
      'code' in envelope &&
      envelope.code === 'GATEWAY_ERROR' &&
      'details' in envelope &&
      envelope.details !== null &&
      typeof envelope.details === 'object'
        ? envelope.details
        : envelope;
    const code = 'code' in payload ? payload.code : undefined;
    if (code === 'TOPIC_NOT_EMPTY')
      return 'Chủ đề còn từ vựng đang sử dụng. Hãy chuyển các từ sang chủ đề khác hoặc xóa các từ trước khi xóa chủ đề.';
    if (code === 'DUPLICATE_CONTENT')
      return 'Dữ liệu này bị trùng với nội dung đã có. Vui lòng kiểm tra lại thông tin chủ đề.';
    if (code === 'CONTENT_ARCHIVED')
      return 'Chủ đề đã được xóa và không thể chỉnh sửa hoặc thêm từ vựng.';
    if (code === 'IDEMPOTENCY_CONFLICT')
      return 'Yêu cầu tạo đã được xử lý với dữ liệu khác. Hãy kiểm tra danh sách chủ đề trước khi tạo lại.';
  }
  return failureMessage(error);
}
