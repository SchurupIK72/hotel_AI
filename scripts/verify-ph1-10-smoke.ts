import { spawnSync } from "node:child_process";
import {
  PHASE1_ACCEPTANCE_MATRIX,
  formatPhase1ReleaseResult,
  getPrimaryAutomationSource,
  summarizePhase1ReleaseChecks,
  type Phase1ReleaseCheck,
} from "../lib/events/release-matrix.ts";

const SCRIPT_RUNNERS: Record<string, string[]> = {
  "test:ph1-02": ["--experimental-strip-types", "./tests/ph1-02/run-checks.ts"],
  "test:ph1-10": ["--experimental-strip-types", "./tests/ph1-10/run-checks.ts"],
  "verify:ph1-03": ["--experimental-strip-types", "./scripts/verify-ph1-03-smoke.ts"],
  "verify:ph1-04": ["--experimental-strip-types", "./scripts/verify-ph1-04-smoke.ts"],
  "verify:ph1-05": ["--experimental-strip-types", "./scripts/verify-ph1-05-smoke.ts"],
  "verify:ph1-06": ["--experimental-strip-types", "./scripts/verify-ph1-06-smoke.ts"],
  "verify:ph1-07": ["--experimental-strip-types", "./scripts/verify-ph1-07-smoke.ts"],
  "verify:ph1-08": ["--experimental-strip-types", "./scripts/verify-ph1-08-smoke.ts"],
  "verify:ph1-09": ["--experimental-strip-types", "./scripts/verify-ph1-09-smoke.ts"],
};

function pickEvidence(output: string, status: "pass" | "fail") {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== "{" && line !== "}" && !line.startsWith("npm notice"));
  if (lines.length === 0) {
    return "No evidence output captured.";
  }
  if (status === "fail") {
    const relevantLine =
      [...lines]
        .reverse()
        .find((line) => /failed|AssertionError|Error:|message:|Expected values/i.test(line)) ??
      lines.at(-1);
    return relevantLine ?? "No failure evidence captured.";
  }
  return lines.at(-1) ?? "No evidence output captured.";
}

function runScript(scriptName: string) {
  const args = SCRIPT_RUNNERS[scriptName];
  if (!args) {
    return {
      status: "fail",
      evidence: `No runner configured for ${scriptName}.`,
    } as const;
  }
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join("\n");
  if (result.error) {
    return {
      status: "fail",
      evidence: `${result.error.name}: ${result.error.message}`,
    } as const;
  }
  return {
    status: result.status === 0 ? "pass" : "fail",
    evidence:
      result.status === 0
        ? pickEvidence(result.stdout || combinedOutput || `${scriptName} completed successfully.`, "pass")
        : pickEvidence(combinedOutput || `Exited with status ${result.status ?? "unknown"}.`, "fail"),
  } as const;
}

function buildCheckResult(): Phase1ReleaseCheck[] {
  const commandResults = new Map<string, ReturnType<typeof runScript>>();
  for (const entry of PHASE1_ACCEPTANCE_MATRIX) {
    const source = getPrimaryAutomationSource(entry);
    if (source?.scriptName && !commandResults.has(source.scriptName)) {
      console.log(`Running ${source.scriptName} for ${entry.key}...`);
      commandResults.set(source.scriptName, runScript(source.scriptName));
    }
  }

  return PHASE1_ACCEPTANCE_MATRIX.map((entry) => {
    const source = getPrimaryAutomationSource(entry);
    if (!source?.scriptName) {
      return {
        key: entry.key,
        criterion: entry.criterion,
        ownerSpec: entry.ownerSpec,
        status: "manual",
        evidence: entry.sources.map((item) => item.evidence).join(" "),
      };
    }

    const commandResult = commandResults.get(source.scriptName)!;
    return {
      key: entry.key,
      criterion: entry.criterion,
      ownerSpec: entry.ownerSpec,
      status: commandResult.status,
      evidence: `${source.scriptName}: ${commandResult.evidence}`,
    };
  });
}

try {
  const releaseResult = summarizePhase1ReleaseChecks(buildCheckResult());
  console.log(formatPhase1ReleaseResult(releaseResult));
  if (releaseResult.outcome === "fail") {
    console.error("PH1-10 release verification failed.");
    process.exit(1);
  }
  console.log("PH1-10 release verification passed.");
} catch (error) {
  console.error("PH1-10 release verification failed.");
  console.error(error);
  process.exit(1);
}
