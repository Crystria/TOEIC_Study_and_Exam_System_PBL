import { createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleCode, KafkaService, writeOutbox } from '@toeic/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { SyncUserDto } from './dto/sync.dto';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly kafka: KafkaService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const userRole = await this.ensureRole(RoleCode.USER);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        roles: { create: { roleId: userRole.id } },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit(user.id, 'USER_REGISTERED', 'user', user.id);
    const tokens = await this.issueTokens(user.id, user.email, this.roleCodes(user.roles));
    return { user: this.toSafeUser(user), ...tokens };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account temporarily locked');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(`Account is ${user.status.toLowerCase()}`);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await this.registerFailedAttempt(user.id, user.failedLoginAttempts + 1);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.audit(user.id, 'USER_LOGIN', 'user', user.id);

    const tokens = await this.issueTokens(user.id, user.email, this.roleCodes(user.roles));
    return { user: this.toSafeUser(user), ...tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string; email: string; roles: RoleCode[] };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'change-me',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash, revokedAt: null },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(payload.sub, payload.email, payload.roles);
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async sync(userId: string, dto: SyncUserDto) {
    const state = await this.prisma.userSyncState.upsert({
      where: { userId_clientDeviceId: { userId, clientDeviceId: dto.clientDeviceId } },
      create: {
        userId,
        clientDeviceId: dto.clientDeviceId,
        lastSyncTime: new Date(dto.lastSyncTime),
        version: dto.version,
      },
      update: { lastSyncTime: new Date(dto.lastSyncTime), version: dto.version },
    });

    await this.prisma.$transaction(async (tx) => {
      await writeOutbox(tx as never, {
        aggregateId: userId,
        eventType: 'UserSyncCompletedEvent',
        payload: {
          userId,
          clientDeviceId: dto.clientDeviceId,
          lastSyncTime: dto.lastSyncTime,
          version: dto.version,
        },
      });
    });
    await this.kafka.emit('user.sync.completed', userId, {
      eventId: state.userId + ':' + dto.clientDeviceId,
      eventType: 'UserSyncCompletedEvent',
      occurredAt: Date.now(),
      payload: { userId, clientDeviceId: dto.clientDeviceId, version: dto.version },
    });
    return state;
  }

  private async registerFailedAttempt(userId: string, attempts: number): Promise<void> {
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    if (shouldLock) {
      this.logger.warn(`User ${userId} locked after ${attempts} failed attempts`);
    }
  }

  private async issueTokens(
    userId: string,
    email: string,
    roles: RoleCode[],
  ): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, roles, type: 'access' },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
        expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email, roles, type: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? 'change-me',
        expiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      },
    });
    return { accessToken, refreshToken };
  }

  private async ensureRole(code: RoleCode) {
    return this.prisma.role.upsert({
      where: { code },
      create: { code, name: code },
      update: {},
    });
  }

  private async audit(
    userId: string | null,
    action: string,
    targetType?: string,
    targetId?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { userId, action, targetType, targetId },
    });
  }

  private roleCodes(roles: { role: { code: string } }[]): RoleCode[] {
    return roles.map((r) => r.role.code as RoleCode);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    status: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      status: user.status,
    };
  }
}
