import { Module } from "@nestjs/common";
import { WebhooksGateway } from "./webhooks.gateway";

@Module({
  providers: [WebhooksGateway],
  exports: [WebhooksGateway],
})
export class WebhooksModule {}
