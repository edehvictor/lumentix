import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { ChallengeRequestDto } from './dto/challenge-request.dto';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from 'src/common/interfaces/authenticated-request.interface';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('challenge')
  @ApiOperation({ summary: 'Request wallet challenge', description: 'Public. Returns a nonce-based message for a public key to sign.' })
  @ApiResponse({ status: 201, description: 'Challenge returned' })
  async requestChallenge(
    @Body() dto: ChallengeRequestDto,
  ): Promise<{ message: string }> {
    return this.walletService.requestChallenge(dto.publicKey);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify and link wallet', description: 'Verifies the signature and links the Stellar public key to the user account.' })
  @ApiResponse({ status: 201, description: 'Wallet verified and linked' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verify(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifySignatureDto,
  ) {
    const { id: userId } = req.user;
    return this.walletService.verifyAndLink(
      userId,
      dto.publicKey,
      dto.signature,
    );
  }
}
