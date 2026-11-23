import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

/** Spec 002: credit cards of the authenticated user. */
@Module({
  imports: [LedgerModule],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
