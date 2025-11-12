/**
 * Research Orchestrator
 *
 * Handles spawning Python subprocess to run GPT Researcher
 * and parsing the JSON output for use in Next.js
 */

import { spawn } from "child_process";
import path from "path";
import type {
  ResearchOptions,
  ResearchResult,
  ResearchFindings,
  ResearchError,
} from "./types";

const PYTHON_SCRIPT_PATH = path.join(
  process.cwd(),
  "python",
  "research_agent.py"
);
const VENV_PYTHON_PATH = path.join(
  process.cwd(),
  "python",
  "venv",
  "bin",
  "python"
);

/**
 * Execute research using Python GPT Researcher subprocess
 */
export async function executeResearch(
  options: ResearchOptions
): Promise<ResearchResult> {
  const { instructions, depth = "moderate", timeout = 300000 } = options;
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    // Spawn Python subprocess
    const pythonProcess = spawn(VENV_PYTHON_PATH, [
      PYTHON_SCRIPT_PATH,
      instructions,
      depth,
    ]);

    // Collect stdout
    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    // Collect stderr
    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Handle process completion
    pythonProcess.on("close", (code) => {
      const executionTime = Date.now() - startTime;

      if (code === 0) {
        // Success - parse JSON from stdout
        try {
          const findings: ResearchFindings = JSON.parse(stdout);
          resolve({
            success: true,
            data: findings,
            executionTime,
          });
        } catch (parseError) {
          resolve({
            success: false,
            error: {
              error: "Failed to parse research output",
              message: parseError instanceof Error ? parseError.message : "Unknown error",
              type: "ParseError",
            },
            executionTime,
          });
        }
      } else {
        // Error - parse JSON from stderr
        try {
          const error: ResearchError = JSON.parse(stderr);
          resolve({
            success: false,
            error,
            executionTime,
          });
        } catch (parseError) {
          resolve({
            success: false,
            error: {
              error: "Research execution failed",
              message: stderr || "Unknown error",
              type: "ExecutionError",
            },
            executionTime,
          });
        }
      }
    });

    // Handle process errors
    pythonProcess.on("error", (error) => {
      const executionTime = Date.now() - startTime;
      resolve({
        success: false,
        error: {
          error: "Failed to spawn Python process",
          message: error.message,
          type: "SpawnError",
        },
        executionTime,
      });
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      pythonProcess.kill();
      const executionTime = Date.now() - startTime;
      resolve({
        success: false,
        error: {
          error: "Research execution timeout",
          message: `Execution exceeded ${timeout}ms timeout`,
          type: "TimeoutError",
        },
        executionTime,
      });
    }, timeout);

    // Clear timeout on completion
    pythonProcess.on("close", () => {
      clearTimeout(timeoutId);
    });
  });
}

/**
 * Test the research orchestrator with a simple query
 */
export async function testResearchOrchestrator(): Promise<ResearchResult> {
  return executeResearch({
    instructions: "What are the basic opening strategies in backgammon?",
    depth: "quick",
    timeout: 120000, // 2 minutes for testing
  });
}
