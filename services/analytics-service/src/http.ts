import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
@Catch()
export class AnalyticsHttpFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<Request>(),
      res = host.switchToHttp().getResponse<Response>(),
      status = error instanceof HttpException ? error.getStatus() : 503,
      value = error instanceof HttpException ? error.getResponse() : {},
      body = typeof value === 'object' ? (value as Record<string, unknown>) : {};
    res.status(status).json({
      statusCode: status,
      code:
        body.code ??
        (
          {
            400: 'VALIDATION_ERROR',
            401: 'INVALID_ACCESS_TOKEN',
            403: 'INSUFFICIENT_ROLE',
            404: 'NOT_FOUND',
          } as Record<number, string>
        )[status] ??
        'DEPENDENCY_UNAVAILABLE',
      message: typeof body.message === 'string' ? body.message : 'Request could not be completed',
      correlationId: res.getHeader('X-Correlation-ID') || randomUUID(),
      timestamp: new Date().toISOString(),
      path: req.path,
      ...(req.path === '/api/v1/ready' && body.checks
        ? { checks: body.checks, status: 'unavailable' }
        : {}),
    });
  }
}
