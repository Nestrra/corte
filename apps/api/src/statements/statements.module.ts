import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { LedgerModule } from '../ledger/ledger.module';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';

/** Spec 003: statements of a card, their installments and payments. */
@Module({
  imports: [LedgerModule, CardsModule],
  controllers: [StatementsController],
  providers: [StatementsService],
})
export class StatementsModule {}
