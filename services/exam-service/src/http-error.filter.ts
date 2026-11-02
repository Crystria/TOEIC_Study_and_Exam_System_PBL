import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<Request>(),
      res = host.switchToHttp().getResponse<Response>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : (error as { code?: string })?.code === 'P2002'
          ? 409
          : 500;
    const response = error instanceof HttpException ? error.getResponse() : undefined;
    const body = typeof response === 'object' ? (response as Record<string, unknown>) : {};
    if (status === 500)
      this.logger.error(
        `Request failed [${req.headers['x-correlation-id']}]: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    res.status(status).json({
      statusCode: status,
      code:
        status === 409
          ? 'CONFLICT'
          : status === 503
            ? 'SERVICE_UNAVAILABLE'
            : status === 500
              ? 'INTERNAL_ERROR'
              : 'REQUEST_ERROR',
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
