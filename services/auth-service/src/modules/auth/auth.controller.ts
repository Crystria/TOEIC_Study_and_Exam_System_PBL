import { Body, Controller, HttpCode, Post, SetMetadata } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload, Public } from '@toeic/common';
import { ContractPipe } from '../../http';
import { AuthService } from './auth.service';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('register') register(
    @Body(new ContractPipe('RegisterRequest'))
    dto: {
      email: string;
      password: string;
      confirmPassword: string;
      fullName: string;
    },
  ) {
    return this.auth.register(dto);
  }
  @Public() @Post('login') @HttpCode(200) login(
    @Body(new ContractPipe('LoginRequest'))
    dto: {
      email: string;
      password: string;
      deviceId: string;
    },
  ) {
    return this.auth.login(dto);
  }
  @Public() @Post('refresh') @HttpCode(200) refresh(
    @Body(new ContractPipe('RefreshRequest')) dto: { refreshToken: string },
  ) {
    return this.auth.refresh(dto.refreshToken);
  }
  @Public() @Post('verify-email') @HttpCode(200) verify(
    @Body(new ContractPipe('VerifyEmailRequest')) dto: { token: string },
  ) {
    return this.auth.verifyEmail(dto.token);
  }
  @Public() @Post('resend-verification') @HttpCode(202) resend(
    @Body(new ContractPipe('ResendRequest')) dto: { email: string },
  ) {
    return this.auth.resend(dto.email);
  }
  @Post('logout')
  @HttpCode(200)
  @SetMetadata('sessionLogout', true)
  logout(
    @CurrentUser() claims: JwtPayload,
    @Body(new ContractPipe('RefreshRequest')) dto: { refreshToken: string },
  ) {
    return this.auth.logout(dto.refreshToken, claims);
  }
}
