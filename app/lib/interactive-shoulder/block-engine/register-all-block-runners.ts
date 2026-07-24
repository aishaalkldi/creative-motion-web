/**
 * Idempotent registration of every catalog Block Runner. Call once at module
 * init or test setup — safe to call repeatedly in the same process.
 */
import { registerInstructionalBlockRunner } from "./instructional-block-runner";
import { registerPatternBlockRunner } from "./pattern-block-runner";
import { registerTargetBlockRunner } from "./target-block-runner";

export function registerAllBlockRunners(): void {
  registerInstructionalBlockRunner();
  registerTargetBlockRunner();
  registerPatternBlockRunner();
}
