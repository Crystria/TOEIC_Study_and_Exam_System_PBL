import { randomUUID } from 'node:crypto';
import { CORRELATION_ID_HEADER } from '@toeic/common';
import { RequestHandler } from 'express';

const MAX_CORRELATION_ID_LENGTH = 128;

export const correlationIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.headers[CORRELATION_ID_HEADER];
  const candidate = typeof incoming === 'string' ? incoming.trim() : '';
  const correlationId =
    candidate.length > 0 && candidate.length <= MAX_CORRELATION_ID_LENGTH
      ? candidate
      : randomUUID();

  req.headers[CORRELATION_ID_HEADER] = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
};
