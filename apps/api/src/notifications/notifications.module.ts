import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { RecurringModule } from '../recurring/recurring.module';
import { BudgetAlertsService } from './budget-alerts.service';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { ExpoPushClient } from './expo-push-client';
import { NotificationsController } from './notifications.controller';
import { NotificationsJobs } from './notifications.jobs';
import { NotificationsService } from './notifications.service';
import { PUSH_CLIENT } from './push-client';
import { PushSender } from './push-sender';
import { RemindersService } from './reminders.service';

/** Spec 006: devices, push sending, budget alerts, reminders job, history and the test push. */
@Module({
  imports: [LedgerModule, RecurringModule],
  controllers: [DevicesController, NotificationsController],
  providers: [
    { provide: PUSH_CLIENT, useClass: ExpoPushClient },
    PushSender,
    DevicesService,
    BudgetAlertsService,
    RemindersService,
    NotificationsService,
    NotificationsJobs,
  ],
  exports: [PushSender, BudgetAlertsService],
})
export class NotificationsModule {}
