import { Global, Module } from "@nestjs/common";
import { PublicStoreReadService } from "./public-store-read.service";

@Global()
@Module({
  providers: [PublicStoreReadService],
  exports: [PublicStoreReadService],
})
export class PublicStoreModule {}
