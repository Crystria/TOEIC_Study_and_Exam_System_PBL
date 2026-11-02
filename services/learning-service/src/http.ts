import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  INestApplication,
  PipeTransform,
  ValidationPipe,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { validateRequest } from '@toeic/contracts/p0/runtime.cjs';
import { Request, Response } from 'express';
export class ContractPipe implements PipeTransform {
  constructor(private readonly definition: string) {}
  transform(value: unknown) {
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
@Catch()
export class LearningHttpFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<Request>(),
      res = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    const value = error instanceof HttpException ? error.getResponse() : {};
    const body = typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const safeExtras =
      req.path === '/api/v1/ready' && body.checks
        ? { checks: body.checks, status: 'unavailable' }
        : {};
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
            409: 'CONFLICT',
          } as Record<number, string>
        )[status] ??
        'DEPENDENCY_UNAVAILABLE',
      message:
        typeof body.message === 'string'
          ? body.message
          : status >= 500
            ? 'Service temporarily unavailable'
            : 'Request rejected',
      correlationId: res.getHeader('X-Correlation-ID') || randomUUID(),
      timestamp: new Date().toISOString(),
      path: req.path,
      ...(body.currentProgress ? { currentProgress: body.currentProgress } : {}),
      ...safeExtras,
    });
  }
}
export function configureLearning(app: INestApplication) {
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1', {
    exclude: [
      'internal/v1/learning/users/:userId/progress',
      'internal/v1/learning/users/:userId/operations/:operationId',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: () =>
        new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Check query parameters' }),
    }),
  );
  app.useGlobalFilters(new LearningHttpFilter());
}
