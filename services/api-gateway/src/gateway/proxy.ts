import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';

interface RouteRule {
  prefix: string;
  configKey: string;
}

const ROUTES: RouteRule[] = [
  { prefix: '/api/v1/auth', configKey: 'AUTH_SERVICE_URL' },
  { prefix: '/api/v1/users', configKey: 'AUTH_SERVICE_URL' },
  { prefix: '/api/v1/admin', configKey: 'AUTH_SERVICE_URL' },
  { prefix: '/api/v1/sync', configKey: 'AUTH_SERVICE_URL' },
  { prefix: '/api/v1/questions', configKey: 'QUESTION_BANK_SERVICE_URL' },
  { prefix: '/api/v1/tests', configKey: 'EXAM_SERVICE_URL' },
  { prefix: '/api/v1/attempts', configKey: 'EXAM_SERVICE_URL' },
  { prefix: '/api/v1/learning', configKey: 'LEARNING_SERVICE_URL' },
  { prefix: '/api/v1/analytics', configKey: 'ANALYTICS_SERVICE_URL' },
  { prefix: '/api/v1/ai', configKey: 'AI_CHATBOX_SERVICE_URL' },
];

/**
 * Tạo proxy dispatcher: chọn upstream theo prefix đường dẫn.
 * Không mount theo path (tránh bị Express strip prefix) — route theo originalUrl.
 */
export function createGatewayProxy(config: ConfigService): RequestHandler {
  const resolveTarget = (req: { url?: string }): string | undefined => {
    const url = req.url ?? '';
    const rule = ROUTES.find((r) => url.startsWith(r.prefix));
    if (!rule) {
      return undefined;
    }
    return config.get<string>(rule.configKey);
  };

  return createProxyMiddleware({
    changeOrigin: true,
    xfwd: true,
    pathFilter: (pathname) => ROUTES.some((r) => pathname.startsWith(r.prefix)),
    router: (req) => resolveTarget(req),
  });
}
