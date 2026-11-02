import { ContractError } from './contracts';

export class GatewayError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
/** These failures can happen after the server has committed a mutation. */
export function mutationOutcomeUnknown(error: unknown): boolean {
  return (
    error instanceof ContractError ||
    (error instanceof GatewayError &&
      (error.status === 0 || error.status === 408 || error.status >= 500))
  );
}
export async function gateway(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<unknown> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`/api/frontend/${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const payload: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các trường.',
        401: 'Phiên đã hết hạn. Vui lòng đăng nhập lại.',
        403: 'Tài khoản không có quyền hoặc chưa hoạt động.',
        404: 'Không tìm thấy dữ liệu.',
        409: 'Dữ liệu đang được sử dụng hoặc đã thay đổi.',
        429: 'Đã đạt giới hạn yêu cầu. Vui lòng thử lại sau.',
        502: 'Chưa kết nối được Gateway.',
        503: 'Kết nối API local/test chưa được cấu hình.',
        504: 'Server phản hồi quá chậm. Chưa xác nhận thao tác thành công.',
      };
      const code =
        payload && typeof payload === 'object' && 'code' in payload ? payload.code : null;
      const codeMessages: Record<string, string> = {
        ISOLATED_TEST_WRITES_NOT_ENABLED:
          'Thao tác ghi đang tắt. Chưa thể cập nhật dữ liệu tài khoản.',
        METADATA_RUNTIME_VERIFICATION_REQUIRED:
          'Metadata chưa được kiểm chứng trên Gateway thực tế.',
        CONTRACT_BLOCKED: 'Chức năng chưa có đủ hợp đồng API để thực hiện.',
      };
      const inactive =
        response.status === 403 &&
        payload !== null &&
        typeof payload === 'object' &&
        'code' in payload &&
        payload.code === 'ACCOUNT_NOT_ACTIVE';
      if ((response.status === 401 || inactive) && typeof window !== 'undefined')
        window.dispatchEvent(
          new CustomEvent('toeic-session-expired', {
            detail: inactive
              ? 'Tài khoản chưa hoạt động hoặc đã bị khóa. Vui lòng kiểm tra với quản trị viên.'
              : messages[401],
          }),
        );
      throw new GatewayError(
        response.status,
        (typeof code === 'string' && codeMessages[code]) ||
          messages[response.status] ||
          'Server gặp lỗi. Dữ liệu nhập được giữ lại.',
        payload,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof GatewayError || options.signal?.aborted) throw error;
    throw new GatewayError(
      controller.signal.aborted ? 504 : 0,
      controller.signal.aborted
        ? 'Yêu cầu hết thời gian chờ. Chưa xác nhận thao tác thành công.'
        : 'Mất kết nối. Chưa xác nhận thao tác thành công.',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
export const failureMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể tải dữ liệu.';

/** Only map known field identifiers, never render arbitrary database/server details. */
export function validationFields(
  error: unknown,
  allowed: readonly string[],
): Record<string, string> {
  if (!(error instanceof GatewayError) || ![400, 409, 422].includes(error.status)) return {};
  const envelope = error.details;
  if (!envelope || typeof envelope !== 'object' || !('details' in envelope)) return {};
  const detail = envelope.details;
  if (!detail || typeof detail !== 'object' || !('message' in detail)) return {};
  const messages =
    typeof detail.message === 'string'
      ? [detail.message]
      : Array.isArray(detail.message)
        ? detail.message
        : [];
  const fields: Record<string, string> = {};
  for (const message of messages) {
    if (typeof message !== 'string') continue;
    for (const field of allowed)
      if (message.toLowerCase().includes(field.toLowerCase()))
        fields[field] = 'Server từ chối giá trị này. Vui lòng kiểm tra lại.';
  }
  return fields;
}
