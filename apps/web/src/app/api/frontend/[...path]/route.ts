import { handleBridge } from '../../../../lib/integration/bridge';
import { examWritesEnabled } from '../../../../lib/integration/exam-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function handler(request: Request, context: { params: { path: string[] } }) {
  return handleBridge(request, context.params.path, {
    app: 'web',
    enabled: process.env.NEXT_PUBLIC_DATA_MODE === 'api',
    environment: process.env.FRONTEND_API_ENV,
    gatewayUrl: process.env.FRONTEND_GATEWAY_URL,
    writesEnabled: process.env.FRONTEND_TEST_WRITES === 'enabled',
    examWritesEnabled: examWritesEnabled(
      process.env.FRONTEND_API_ENV,
      process.env.FRONTEND_EXAM_WRITES,
    ),
  });
}
export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
