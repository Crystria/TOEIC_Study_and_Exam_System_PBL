import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CORRELATION_ID_HEADER } from '@toeic/common';
import { Request, Response } from 'express';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { BufferedRequest } from './body-limit.middleware';
import { sendGatewayError } from './http-error';
import { matchRoute, normalizePath, proxyTimeoutMs } from './route-policy';

const logger = new Logger('GatewayProxy');

function pathnameOf(url: string | undefined): string {
  return normalizePath((url ?? '/').split('?')[0] ?? '/');
}

function isTimeoutError(error: Error): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT';
}

function correlationIdOf(req: IncomingMessage): string {
  const value = req.headers[CORRELATION_ID_HEADER];
  return typeof value === 'string' ? value : '';
}

export function createGatewayProxy(config: ConfigService): RequestHandler {
  const resolveTarget = (req: IncomingMessage): string | undefined => {
    const rule = matchRoute(pathnameOf(req.url));
    if (!rule) {
      return undefined;
    }

    const target = config.get<string>(rule.upstream);
    if (!target) {
      logger.error(`Missing upstream configuration: ${rule.upstream}`);
    }
    return target;
  };

  const commonOptions = {
    changeOrigin: true,
    xfwd: true,
    pathFilter: (pathname: string) => Boolean(matchRoute(pathname)),
    router: resolveTarget,
    on: {
      proxyReq: (proxyReq: import('node:http').ClientRequest, req: IncomingMessage) => {
        const correlationId = correlationIdOf(req);
        const connectTimer = setTimeout(() => {
          const error = Object.assign(new Error('Upstream connection timed out'), {
            code: 'ETIMEDOUT',
          });
          proxyReq.destroy(error);
        }, 2_000);
        const clearConnectTimer = () => clearTimeout(connectTimer);
        const watchSocket = (socket: import('node:net').Socket) => {
          if (!socket.connecting) clearConnectTimer();
          else socket.once('connect', clearConnectTimer);
        };
        if (proxyReq.socket) watchSocket(proxyReq.socket);
        else proxyReq.once('socket', watchSocket);
        proxyReq.once('close', clearConnectTimer);
        proxyReq.once('error', clearConnectTimer);
        proxyReq.setTimeout(proxyTimeoutMs(req.method ?? 'GET', pathnameOf(req.url)), () => {
          proxyReq.destroy(
            Object.assign(new Error('Upstream response timed out'), { code: 'ETIMEDOUT' }),
          );
        });
        if (correlationId) {
          proxyReq.setHeader(CORRELATION_ID_HEADER, correlationId);
        }
      },
      proxyRes: (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
        const correlationId = correlationIdOf(req);
        if (correlationId) {
          proxyRes.headers[CORRELATION_ID_HEADER] = correlationId;
          res.setHeader(CORRELATION_ID_HEADER, correlationId);
        }
      },
      error: (
        error: Error,
        req: IncomingMessage,
        res: ServerResponse | import('node:net').Socket,
      ) => {
        const statusCode = isTimeoutError(error) ? 504 : 502;
        const code = isTimeoutError(error) ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR';
        const correlationId = correlationIdOf(req);

        logger.error(
          `Proxy ${req.method ?? 'UNKNOWN'} ${req.url ?? '/'} failed ` +
            `[${correlationId || 'no-correlation-id'}]: ${error.message}`,
        );

        if (!(res instanceof ServerResponse)) {
          res.destroy();
          return;
        }

        sendGatewayError(
          req as unknown as Request,
          res as unknown as Response,
          statusCode,
          code,
          statusCode === 504 ? 'Upstream service timed out' : 'Upstream service unavailable',
        );
      },
    },
  };

  const dispatcher = ((req, res, next) => {
    const route = matchRoute(pathnameOf(req.url));
    if (!route) return next?.();
    if (!config.get<string>(route.upstream)) {
      sendGatewayError(
        req as Request,
        res as Response,
        502,
        'UPSTREAM_ERROR',
        'Upstream service unavailable',
      );
      return;
    }
    const body = (req as BufferedRequest).rawBody;
    const proxy = createProxyMiddleware({
      ...commonOptions,
      ...(body ? { buffer: Readable.from(body.length ? [body] : []) } : {}),
    });
    return proxy(req, res, next);
  }) as RequestHandler;
  return dispatcher;
}
