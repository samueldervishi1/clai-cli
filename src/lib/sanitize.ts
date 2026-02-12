/**
 * Sanitization utilities for terminal input/output
 * Prevents terminal escape sequence injection and other security issues
 */

/**
 * Sanitize user input by removing/escaping terminal control sequences
 * Prevents terminal manipulation attacks via escape sequences
 */
export function sanitizeInput(input: string): string {
  if (!input) return input;

  // Remove ANSI escape sequences (CSI sequences)
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");

  // Remove other escape sequences
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/\x1b[^[]/g, "");

  // Remove C0 control characters except newline, tab, and carriage return
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
}

/**
 * Sanitize output to prevent accidental terminal corruption
 * More lenient than input sanitization - allows formatting but removes dangerous sequences
 */
export function sanitizeOutput(output: string): string {
  if (!output) return output;

  // Only remove dangerous control sequences that could:
  // 1. Change terminal title
  // 2. Execute commands
  // 3. Manipulate cursor in dangerous ways

  // Remove OSC (Operating System Command) sequences that can change title or execute commands
  // eslint-disable-next-line no-control-regex
  let sanitized = output.replace(/\x1b\][^\x07]*\x07/g, "");
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/\x1b\][^\x1b]*\x1b\\/g, "");

  // Remove other potentially dangerous escape sequences
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/\x1b[P^_]/g, "");

  return sanitized;
}

/**
 * Sanitize file paths in error messages to prevent information disclosure
 */
export function sanitizeErrorPath(errorMessage: string, workingDir: string): string {
  // Replace absolute paths with relative paths
  return errorMessage.replace(new RegExp(workingDir, "g"), ".");
}

/**
 * Validate and sanitize URLs to prevent various injection attacks
 */
export function sanitizeUrl(url: string): { valid: boolean; sanitized: string; error?: string } {
  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        valid: false,
        sanitized: "",
        error: "Only HTTP and HTTPS protocols are allowed",
      };
    }

    // Return the normalized URL
    return {
      valid: true,
      sanitized: parsed.toString(),
    };
  } catch {
    return {
      valid: false,
      sanitized: "",
      error: "Invalid URL format",
    };
  }
}
