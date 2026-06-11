import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';

class UpdateMeDto {
  @ApiPropertyOptional({ description: 'Onboarding: tanlangan viloyat' })
  @IsOptional()
  @IsUUID()
  regionId?: string;
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Joriy foydalanuvchi' })
  async me(@CurrentUser() user: JwtPayload) {
    const found = await this.prisma.appUser.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        tgUserId: true,
        username: true,
        firstName: true,
        regionId: true,
        role: true,
        region: { select: { id: true, code: true, nameUz: true } },
      },
    });
    if (!found) throw AppException.notFound('Foydalanuvchi topilmadi');
    return { ...found, tgUserId: found.tgUserId.toString() };
  }

  @Patch()
  @ApiOperation({ summary: 'Profil yangilash (viloyat tanlash)' })
  async update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    const updated = await this.prisma.appUser.update({
      where: { id: user.sub },
      data: { regionId: dto.regionId },
      select: { id: true, regionId: true },
    });
    return updated;
  }
}
