import { RequestHandler } from 'express';
import { sendGatewayError } from './http-error';
import { Request } from 'express';

export type BufferedRequest = Request & { rawBody?: Buffer };

export const DEFAULT_BODY_LIMIT_BYTES = 1024 * 1024;

export function createBodyLimitMiddleware(maxBytes = DEFAULT_BODY_LIMIT_BYTES): RequestHandler {
  return (req, res, next) => {
    const rawLength = req.headers['content-length'];
    const contentLength = Number(rawLength);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      req.resume();
      sendGatewayError(
        req,
        res,
        413,
        'PAYLOAD_TOO_LARGE',
        `Request body exceeds ${maxBytes} bytes`,
      );
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;
    req.on('data', (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > maxBytes) {
        rejected = true;
        chunks.length = 0;
        sendGatewayError(
          req,
          res,
          413,
          'PAYLOAD_TOO_LARGE',
          `Request body exceeds ${maxBytes} bytes`,
        );
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      (req as BufferedRequest).rawBody = Buffer.concat(chunks);
      next();
    });
    req.on('error', () => {
      rejected = true;
      chunks.length = 0;
    });
  };
}
