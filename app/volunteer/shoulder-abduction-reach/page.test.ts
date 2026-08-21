/**
 * Run: npx tsx --test app/volunteer/shoulder-abduction-reach/page.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const PAGE_PATH = join(process.cwd(), "app/volunteer/shoulder-abduction-reach/page.tsx");
const HOOK_PATH = join(process.cwd(), "app/hooks/useVolunteerCaptureSession.ts");
const PROXY_PATH = join(process.cwd(), "proxy.ts");

const VOLUNTEER_SOURCE_FILES = [
  PAGE_PATH,
  HOOK_PATH,
  join(process.cwd(), "app/volunteer/shoulder-abduction-reach/volunteer-protocol.ts"),
  join(process.cwd(), "app/volunteer/shoulder-abduction-reach/volunteer-capture-sink.ts"),
  join(process.cwd(), "app/volunteer/shoulder-abduction-reach/components/VolunteerWizardShell.tsx"),
];

describe("volunteer shoulder abduction reach — Slice 8A integrity", () => {
  it("proxy.ts exposes only the exact volunteer page path (not a broad /volunteer prefix)", () => {
    const source = readFileSync(PROXY_PATH, "utf8");
    assert.match(source, /["']\/volunteer\/shoulder-abduction-reach["']/);
    const prefixesBlock = source.slice(
      source.indexOf("const PUBLIC_PREFIXES"),
      source.indexOf("const PUBLIC_PATHS"),
    );
    assert.doesNotMatch(prefixesBlock, /\/volunteer/);
  });

  it("consent Continue stays disabled until both checkboxes are required in source", () => {
    const source = readFileSync(PAGE_PATH, "utf8");
    assert.match(source, /canProceedFromConsent\(consent\)/);
    assert.match(source, /ageConfirmed/);
    assert.match(source, /participationAgreed/);
    assert.match(source, /disabled=\{!canProceedFromConsent\(consent\)\}/);
  });

  it("startCapture calls stop-before-start in the volunteer hook", () => {
    const source = readFileSync(HOOK_PATH, "utf8");
    const startBody = source.slice(
      source.indexOf("const startCapture = useCallback"),
      source.indexOf("}, [side, captureSink, stopDetector, stopPreviewStream]);"),
    );
    const stopCallIndex = startBody.indexOf("stopDetector();");
    const constructorIndex = startBody.indexOf("new ShoulderAbductionReachPoseDetector");
    assert.ok(stopCallIndex >= 0, "startCapture must call stopDetector() first");
    assert.ok(constructorIndex > stopCallIndex, "stopDetector() must run before constructing detector");
  });

  it("volunteer source files never import dev-capture-sink or dev API helpers", () => {
    for (const filePath of VOLUNTEER_SOURCE_FILES) {
      const source = readFileSync(filePath, "utf8");
      assert.doesNotMatch(source, /from\s+["']@\/app\/lib\/ml-research\/shoulder-abduction-reach\/dev-capture-sink["']/);
      assert.doesNotMatch(source, /from\s+["'][^"']*dev-capture-sink[^"']*["']/);
      assert.doesNotMatch(source, /createDevRepCaptureSink/);
      assert.doesNotMatch(source, /postDevRepCaptureRecord/);
      assert.doesNotMatch(source, /\/api\/dev\//);
    }
  });

  for (const filePath of VOLUNTEER_SOURCE_FILES) {
    const label = filePath.replace(process.cwd(), "").replace(/\\/g, "/");
    it(`${label} does not persist movement data or call dev/production APIs`, () => {
      const source = readFileSync(filePath, "utf8");
      assert.doesNotMatch(source, /supabase/i);
      assert.doesNotMatch(source, /\/api\/dev\//i);
      assert.doesNotMatch(source, /postDevRepCaptureRecord/);
      assert.doesNotMatch(source, /localStorage/);
      assert.doesNotMatch(source, /sessionStorage/);
      assert.doesNotMatch(source, /fetch\s*\(\s*["'`][^"'`]*["'`]\s*,\s*\{[^}]*method:\s*["']POST["']/i);
    });
  }
});
