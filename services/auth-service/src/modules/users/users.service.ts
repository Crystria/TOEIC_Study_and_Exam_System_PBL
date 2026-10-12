import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleCode } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toSafeUser(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { ...dto },
      include: { roles: { include: { role: true } } },
    });
    return this.toSafeUser(user);
  }

  async listUsers(query: ListUsersQueryDto) {
    const where = {
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.keyword
        ? {
            OR: [
              { email: { contains: query.keyword, mode: 'insensitive' as const } },
              { fullName: { contains: query.keyword, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { roles: { include: { role: true } } },
        skip: (query.page - 1) * query.size,
        take: query.size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map((u) => this.toSafeUser(u)), total, page: query.page, size: query.size };
  }

  async updateRoles(userId: string, roles: RoleCode[]) {
    await this.replaceRoles(userId, roles);
    return this.getMe(userId);
  }

  async updateStatus(userId: string, dto: UpdateStatusDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status as never },
    });
    return this.getMe(userId);
  }

  async listAuditLogs(page = 1, size = 20) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        skip: (page - 1) * size,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, page, size };
  }

  private async replaceRoles(userId: string, roles: RoleCode[]): Promise<void> {
    const roleRecords = await Promise.all(
      roles.map((code) =>
        this.prisma.role.upsert({ where: { code }, create: { code, name: code }, update: {} }),
      ),
    );
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roleRecords.map((role) => ({ userId, roleId: role.id })),
      }),
    ]);
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    phoneNumber: string | null;
    status: string;
    createdAt: Date;
    roles: { role: { code: string; name: string } }[];
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      phoneNumber: user.phoneNumber,
      status: user.status,
      createdAt: user.createdAt,
      roles: user.roles.map((r) => ({ code: r.role.code, name: r.role.name })),
    };
  }
}
