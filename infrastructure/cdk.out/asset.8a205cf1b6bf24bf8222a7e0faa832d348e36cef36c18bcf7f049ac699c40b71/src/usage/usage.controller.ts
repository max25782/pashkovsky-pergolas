import { Controller } from "@nestjs/common";
import { UsageService } from "./usage.service";

@Controller("usage")
export class UsageController {
  constructor(private readonly usageService: UsageService) {}
  // TODO: Implement usage endpoints in Phase 4
}
