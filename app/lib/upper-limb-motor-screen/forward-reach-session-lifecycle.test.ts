/**
 * Run:
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/upper-limb-motor-screen/forward-reach-session-lifecycle.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveForwardReachSessionPhase } from "./forward-reach-session-lifecycle";

describe("resolveForwardReachSessionPhase", () => {
  it("non-UUID (numeric/demo) patient -> blockedNonUuidPatient, regardless of other state", () => {
    assert.equal(
      resolveForwardReachSessionPhase({
        isUuidPatient: false,
        assignment: { id: "a1" },
        sessionResult: { status: "finalized" },
      }),
      "blockedNonUuidPatient",
    );
  });

  it("UUID patient, no assignment -> setup (never fabricates one)", () => {
    assert.equal(
      resolveForwardReachSessionPhase({ isUuidPatient: true, assignment: null, sessionResult: null }),
      "setup",
    );
  });

  it("assignment exists, no session result -> readyToRun (resume/start runtime)", () => {
    assert.equal(
      resolveForwardReachSessionPhase({
        isUuidPatient: true,
        assignment: { id: "a1" },
        sessionResult: null,
      }),
      "readyToRun",
    );
  });

  it("assignment exists, computed result -> computedUnfinalized (show saved result + Finalize action, do not create another)", () => {
    assert.equal(
      resolveForwardReachSessionPhase({
        isUuidPatient: true,
        assignment: { id: "a1" },
        sessionResult: { status: "computed" },
      }),
      "computedUnfinalized",
    );
  });

  it("assignment exists, finalized result -> finalized (read-only + Start new session)", () => {
    assert.equal(
      resolveForwardReachSessionPhase({
        isUuidPatient: true,
        assignment: { id: "a1" },
        sessionResult: { status: "finalized" },
      }),
      "finalized",
    );
  });
});
