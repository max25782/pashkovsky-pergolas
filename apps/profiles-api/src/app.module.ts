import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProfilesModule } from './profiles/profiles.module';
import { BatchesModule } from './batches/batches.module';
import { StockModule } from './stock/stock.module';
import { OrdersModule } from './orders/orders.module';
import { UsageModule } from './usage/usage.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ProfilesModule,
    BatchesModule,
    StockModule,
    OrdersModule,
    UsageModule,
    SuppliersModule,
    WebhooksModule,
  ],
})
export class AppModule {}
