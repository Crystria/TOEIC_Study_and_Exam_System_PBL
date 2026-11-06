import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ContractPipe } from '../../http';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type LoginInput = Parameters<AuthService['login']>[0];
const valid: LoginInput = { email: 'learner@example.test', password: 'x', deviceId: 'unit-web' };
const missing = (field: keyof LoginInput) => {
  const input: Partial<LoginInput> = { ...valid };
  delete input[field];
  return input;
};
const invalid: Array<{ name: string; input: unknown }> = [
  ...(['email', 'password', 'deviceId'] as const).map((field) => ({
    name: `missing ${field}`,
    input: missing(field),
  })),
  ...(['email', 'password', 'deviceId'] as const).flatMap((field) =>
    [null, undefined, 42, false, [], {}].map((value, index) => ({
      name: `${field} non-string variant ${index + 1}`,
      input: { ...valid, [field]: value },
    })),
  ),
  ...[undefined, null, '', 'login', 42, false, [], ['login']].map((input, index) => ({
    name: `non-object body variant ${index + 1}`,
    input,
  })),
  ...['', ' ', 'learner', 'learner@', '@example.test', 'a b@example.test'].map((email, index) => ({
    name: `malformed email variant ${index + 1}`,
    input: { ...valid, email },
  })),
  {
    name: 'email exceeds 320 characters',
    input: { ...valid, email: 'a'.repeat(308) + '@example.test' },
  },
  { name: 'empty password', input: { ...valid, password: '' } },
  { name: 'password exceeds 72 characters', input: { ...valid, password: 'a'.repeat(73) } },
  {
    name: 'password has 73 UTF-8 bytes within 37 characters',
    input: { ...valid, password: 'é'.repeat(36) + 'a' },
  },
  { name: 'empty deviceId', input: { ...valid, deviceId: '' } },
  { name: 'deviceId exceeds 255 characters', input: { ...valid, deviceId: 'd'.repeat(256) } },
  { name: 'unexpected roles property', input: { ...valid, roles: ['SYSTEM_ADMIN'] } },
];

describe('UT-004 | login contract validation', () => {
  let service: { login: jest.Mock };
  let controller: AuthController;
  let pipe: ContractPipe;
  beforeEach(() => {
    service = { login: jest.fn().mockResolvedValue({ accepted: true }) };
    controller = new AuthController(service as unknown as AuthService);
    // Use the actual @Body pipe registered on this controller, rather than an unrelated validator.
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, AuthController, 'login') as Record<
      string,
      { pipes: unknown[] }
    >;
    const configured = metadata[`${RouteParamtypes.BODY}:0`].pipes;
    expect(configured).toHaveLength(1);
    expect(configured[0]).toBeInstanceOf(ContractPipe);
    pipe = configured[0] as ContractPipe;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  function dispatch(input: unknown) {
    // Isolated Nest argument-pipe -> controller sequence. This is not an HTTP server test.
    const dto = pipe.transform(input) as LoginInput;
    return controller.login(dto);
  }

  it.each(invalid)('rejects $name before invoking login', ({ input }) => {
    expect(() => dispatch(input)).toThrow(BadRequestException);
    expect(service.login).not.toHaveBeenCalled();
  });

  it('returns the stable validation error without echoing passwords, hashes or DTO fields', () => {
    const input = { ...valid, password: { passwordHash: 'should-not-escape' } };
    try {
      dispatch(input);
      throw new Error('Invalid input was accepted');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse();
      expect((error as BadRequestException).getStatus()).toBe(400);
      expect(response).toEqual({ code: 'VALIDATION_ERROR', message: 'Check the submitted fields' });
      expect(JSON.stringify(response)).not.toContain('should-not-escape');
      expect(JSON.stringify(response)).not.toContain('passwordHash');
    }
    expect(service.login).not.toHaveBeenCalled();
  });

  it('normalizes valid email without changing the caller DTO or applying registration password rules', async () => {
    const input = Object.freeze({ ...valid, email: '  Learner@Example.TEST  ' });
    const before = { ...input };
    await expect(dispatch(input)).resolves.toEqual({ accepted: true });
    expect(service.login).toHaveBeenCalledTimes(1);
    expect(service.login).toHaveBeenCalledWith(valid);
    expect(input).toEqual(before);
  });

  it.each([
    { label: '71 UTF-8 bytes', password: 'é'.repeat(35) + 'a' },
    { label: '72 UTF-8 bytes', password: 'é'.repeat(36) },
    { label: '72 ASCII characters', password: 'a'.repeat(72) },
  ])('accepts the login password boundary at $label', async ({ password }) => {
    const input = { ...valid, password };
    await expect(dispatch(input)).resolves.toEqual({ accepted: true });
    expect(service.login).toHaveBeenCalledTimes(1);
    expect(service.login).toHaveBeenCalledWith(input);
  });

  it('accepts a deviceId of exactly 255 characters', async () => {
    const input = { ...valid, deviceId: 'd'.repeat(255) };
    await expect(dispatch(input)).resolves.toEqual({ accepted: true });
    expect(service.login).toHaveBeenCalledWith(input);
  });
});
