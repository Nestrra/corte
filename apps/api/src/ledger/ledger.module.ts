import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';

/** Spec 003: shared writes and derived totals of purchases, installments and statements. */
@Module({
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
