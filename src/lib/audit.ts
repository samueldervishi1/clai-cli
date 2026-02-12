/**
 * Audit logging for security-relevant operations
 */

import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const CONFIG_DIR = resolve(
  process.env.XDG_CONFIG_HOME ?? resolve(process.env.HOME ?? "~", ".config"),
  "clai",
);
const AUDIT_LOG_PATH = resolve(CONFIG_DIR, "audit.log");

export interface AuditEntry {
  timestamp: string;
  action: "tool_call" | "tool_approved" | "tool_denied" | "sensitive_file_access";
  toolName: string;
  input: Record<string, unknown>;
  result?: "success" | "error" | "denied";
  details?: string;
}

/**
 * Log an audit entry
 */
export function logAudit(entry: AuditEntry): void {
  try {
    // Ensure config directory exists
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }

    // Format as JSON for easy parsing
    const line = JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString(),
    });

    appendFileSync(AUDIT_LOG_PATH, line + "\n", { mode: 0o600 });
  } catch (error) {
    // Don't throw - audit logging failure shouldn't break the app
    console.error("Audit log error:", error);
  }
}

/**
 * Log a tool execution attempt
 */
export function logToolCall(toolName: string, input: Record<string, unknown>): void {
  logAudit({
    timestamp: new Date().toISOString(),
    action: "tool_call",
    toolName,
    input,
  });
}

/**
 * Log tool approval
 */
export function logToolApproved(
  toolName: string,
  input: Record<string, unknown>,
  success: boolean,
  details?: string,
): void {
  logAudit({
    timestamp: new Date().toISOString(),
    action: "tool_approved",
    toolName,
    input,
    result: success ? "success" : "error",
    details,
  });
}

/**
 * Log tool denial
 */
export function logToolDenied(toolName: string, input: Record<string, unknown>): void {
  logAudit({
    timestamp: new Date().toISOString(),
    action: "tool_denied",
    toolName,
    input,
    result: "denied",
  });
}

/**
 * Log sensitive file access attempt
 */
export function logSensitiveFileAccess(
  toolName: string,
  filePath: string,
  approved: boolean,
): void {
  logAudit({
    timestamp: new Date().toISOString(),
    action: "sensitive_file_access",
    toolName,
    input: { path: filePath },
    result: approved ? "success" : "denied",
  });
}

/**
 * Get audit log path for display
 */
export function getAuditLogPath(): string {
  return AUDIT_LOG_PATH;
}
