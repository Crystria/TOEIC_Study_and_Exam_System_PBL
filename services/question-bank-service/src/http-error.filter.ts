import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>(),
      res = host.switchToHttp().getResponse<Response>();
    const prismaCode = (error as { code?: string })?.code;
    const status =
      error instanceof HttpException ? error.getStatus() : prismaCode === 'P2002' ? 409 : 500;
    const response = error instanceof HttpException ? error.getResponse() : undefined;
    const body = typeof response === 'object' ? (response as Record<string, unknown>) : {};
    res
      .status(status)
      .json({
        statusCode: status,
        code: status === 409 ? 'CONFLICT' : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message:
          body.message ??
          (typeof response === 'string'
            ? response
            : status === 409
              ? 'Resource conflict'
              : 'Internal server error'),
        ...(body.details ? { details: body.details } : {}),
        correlationId: req.headers['x-correlation-id'],
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
  }
}
