import { ArgumentsHost, ServiceUnavailableException } from '@nestjs/common';
import { AuthHttpFilter } from './http';

describe('Auth HTTP failure diagnostics', () => {
  function response(path: string, error: unknown) {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      getHeader: () => 'test-correlation',
    };
    const host = {
      switchToHttp: () => ({ getRequest: () => ({ path }), getResponse: () => res }),
    } as unknown as ArgumentsHost;
    new AuthHttpFilter().catch(error, host);
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  }
  it('retains only safe dependency statuses on readiness failure', () => {
    const result = response(
      '/api/v1/ready',
      new ServiceUnavailableException({
        status: 'unavailable',
        checks: { postgres: 'ok', redis: 'unavailable', private: 'secret' },
        detail: 'redis://private-credential',
      }),
    );
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({
      statusCode: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      status: 'unavailable',
      checks: { postgres: 'ok', redis: 'unavailable' },
    });
    expect(Object.keys(result.body.checks).sort()).toEqual(['postgres', 'redis']);
    expect(JSON.stringify(result.body)).not.toContain('private');
  });
  it('hides unexpected errors and does not attach readiness fields to business errors', () => {
    const result = response('/api/v1/auth/login', new Error('postgresql://private-credential'));
    expect(result.status).toBe(503);
    expect(result.body.checks).toBeUndefined();
    expect(JSON.stringify(result.body)).not.toContain('private');
  });
});
