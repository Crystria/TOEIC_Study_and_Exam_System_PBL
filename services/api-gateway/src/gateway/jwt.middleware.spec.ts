import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { createJwtMiddleware } from './jwt.middleware';

describe('Gateway JWT for new CMS metadata and legacy Test GETs (no real JWT)', () => {
  const jwt = { verifyAsync: jest.fn() };
  const middleware = createJwtMiddleware(jwt as unknown as JwtService, {
    secret: 'stub-public-key',
    algorithm: 'RS256',
    issuer: 'toeic-auth',
    audience: 'toeic-api',
  });
  const paths = [
    '/api/v1/tests/cms-metadata',
    '/api/v1/tests/cms-metadata/demo-test-001',
    '/api/v1/tests',
    '/api/v1/tests/demo-test-002',
  ];

  async function invoke(path: string, authorization?: string, method = 'GET') {
    const req = { path, method, headers: { authorization } } as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), getHeader: jest.fn() };
    const next = jest.fn();
    await middleware(req, res as unknown as Response, next as NextFunction);
    return { req, res, next };
  }

  beforeEach(() => {
    jwt.verifyAsync.mockReset();
  });

  describe.each(paths)('GET %s', (path) => {
    it('is outside the public allowlist and stops before next/proxy without JWT', async () => {
      const { res, next } = await invoke(path);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Missing access token',
        }),
      );
      expect(jwt.verifyAsync).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('stops before next/proxy when JWT verification rejects', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('synthetic verification failure'));
      const { res, next } = await invoke(path, 'Bearer isolated-placeholder');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('passes Authorization through after verification, leaving roles to Exam', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user',
        sid: 'session',
        jti: 'jti',
        type: 'access',
        userVersion: '0',
        sessionVersion: '0',
        iat: 1,
        exp: 9999999999,
        roles: ['USER'],
      });
      const { req, res, next } = await invoke(path, 'Bearer isolated-placeholder');
      expect(jwt.verifyAsync).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(req.headers.authorization).toBe('Bearer isolated-placeholder');
    });
  });

  it('keeps OPTIONS distinct from an authenticated metadata GET', async () => {
    const { next } = await invoke(paths[0], undefined, 'OPTIONS');
    expect(next).toHaveBeenCalledTimes(1);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });
});
