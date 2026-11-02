import { handleBridge } from '../../../../../../web/src/lib/integration/bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function handler(request: Request, context: { params: { path: string[] } }) {
  return handleBridge(request, context.params.path, {
    app: 'cms',
    enabled: process.env.NEXT_PUBLIC_DATA_MODE === 'api',
    environment: process.env.FRONTEND_API_ENV,
    gatewayUrl: process.env.FRONTEND_GATEWAY_URL,
    metadataVerified: process.env.FRONTEND_METADATA_VERIFIED === 'true',
    writesEnabled: process.env.FRONTEND_TEST_WRITES === 'enabled',
  });
}
export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
