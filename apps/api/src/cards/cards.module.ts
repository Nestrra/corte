import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

/** Spec 002: credit cards of the authenticated user. */
@Module({
  controllers: [CardsController],
  providers: [CardsService],
})
export class CardsModule {}
