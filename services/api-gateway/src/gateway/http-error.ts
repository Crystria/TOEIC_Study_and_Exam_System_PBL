import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '@toeic/common';

export interface GatewayErrorBody {
  statusCode: number;
  code: string;
  message: string;
  correlationId: string;
  timestamp: string;
  path: string;
}

export function getCorrelationId(req: Request, res: Response): string {
  const fromResponse = res.getHeader(CORRELATION_ID_HEADER);
  if (typeof fromResponse === 'string' && fromResponse.length > 0) {
    return fromResponse;
  }
  const fromRequest = req.headers[CORRELATION_ID_HEADER];
  return typeof fromRequest === 'string' && fromRequest.length > 0 ? fromRequest : '';
}

export function sendGatewayError(
  req: Request,
  res: Response,
  statusCode: number,
  code: string,
  message: string,
): void {
  if (res.headersSent) {
    return;
  }

  const correlationId = getCorrelationId(req, res);
  const body: GatewayErrorBody = {
    statusCode,
    code,
    message,
    correlationId,
    timestamp: new Date().toISOString(),
    path: req.originalUrl || req.url,
  };

  res.status(statusCode).json(body);
}
