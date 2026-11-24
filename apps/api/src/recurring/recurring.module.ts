import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { OccurrencesController } from './occurrences.controller';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';

/** Spec 005: recurring payments and their occurrences, apart from the cards. */
@Module({
  imports: [LedgerModule],
  controllers: [RecurringController, OccurrencesController],
  providers: [RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}
