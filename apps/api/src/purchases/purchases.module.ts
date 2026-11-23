import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

/** Spec 003: purchases and their installment plans. */
@Module({
  imports: [LedgerModule, CardsModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
