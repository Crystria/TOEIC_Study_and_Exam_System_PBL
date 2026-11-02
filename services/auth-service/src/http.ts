import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  INestApplication,
  PipeTransform,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Request, Response, json } from 'express';
import { validateRequest } from '@toeic/contracts/p0/runtime.cjs';
import { AuditContext } from './identity';

export class ContractPipe implements PipeTransform {
  constructor(private readonly definition: string) {}
  transform(input: unknown): unknown {
    let value = input;
    if (
      ['RegisterRequest', 'LoginRequest', 'ResendRequest'].includes(this.definition) &&
      input &&
      typeof input === 'object'
    ) {
      const body = input as Record<string, unknown>;
      value = {
        ...body,
        ...(typeof body.email === 'string' ? { email: body.email.trim().toLowerCase() } : {}),
      };
    }
    try {
      validateRequest(this.definition, value);
    } catch {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Check the submitted fields',
      });
    }
    return value;
  }
}
export function auditContext(req: Request): AuditContext {
  return {
    correlationId: String(req.res?.getHeader('X-Correlation-ID') || randomUUID()),
    ip: req.ip,
  };
}
@Catch()
export class AuthHttpFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<Request>(),
      res = host.switchToHttp().getResponse<Response>();
    const parserType = (error as { type?: string } | null)?.type;
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : parserType === 'entity.too.large'
          ? 413
          : parserType === 'entity.parse.failed'
            ? 400
            : 503;
    const body = error instanceof HttpException ? error.getResponse() : {};
    const value = typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const message =
      typeof value.message === 'string'
        ? value.message
        : status >= 500
          ? 'Service temporarily unavailable'
          : 'Request rejected';
    const checks = value.checks as Record<string, unknown> | undefined;
    const readiness =
      req.path === '/api/v1/ready' && value.status === 'unavailable' && checks
        ? {
            status: 'unavailable',
            checks: {
              postgres: checks.postgres === 'ok' ? 'ok' : 'unavailable',
              redis: checks.redis === 'ok' ? 'ok' : 'unavailable',
            },
          }
        : {};
    res.status(status).json({
      statusCode: status,
      code:
        value.code ??
        (
          {
            400: 'VALIDATION_ERROR',
            413: 'PAYLOAD_TOO_LARGE',
            401: 'INVALID_ACCESS_TOKEN',
            403: 'INSUFFICIENT_ROLE',
            404: 'NOT_FOUND',
            503: 'DEPENDENCY_UNAVAILABLE',
          } as Record<number, string>
        )[status] ??
        `HTTP_${status}`,
      message,
      correlationId: res.getHeader('X-Correlation-ID') || randomUUID(),
      timestamp: new Date().toISOString(),
      path: req.path,
      ...readiness,
    });
  }
}
export function configureAuth(app: INestApplication): void {
  app.enableShutdownHooks();
  app.use(json({ limit: 256 * 1024 }));
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'internal/v1/auth/authorization-state', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: () =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        }),
    }),
  );
  app.useGlobalFilters(new AuthHttpFilter());
}
