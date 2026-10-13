import { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { CORRELATION_ID_HEADER } from '@toeic/common';

export const correlationIdMiddleware: RequestHandler = (req, res, next) => {
  const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) ?? randomUUID();
  req.headers[CORRELATION_ID_HEADER] = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
};
