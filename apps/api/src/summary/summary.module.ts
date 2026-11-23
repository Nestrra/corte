import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { LedgerModule } from '../ledger/ledger.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

/** Spec 004: the data of the home screen. */
@Module({
  imports: [LedgerModule, CardsModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
