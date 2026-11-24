import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { LedgerModule } from '../ledger/ledger.module';
import { RecurringModule } from '../recurring/recurring.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

/** Specs 004 and 005: the data of the home screen. */
@Module({
  imports: [LedgerModule, CardsModule, RecurringModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
