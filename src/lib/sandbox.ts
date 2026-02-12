import { resolve, relative, basename, sep } from "node:path";
import { statSync, realpathSync } from "node:fs";

// Only allow access within the current working directory
const CWD = process.cwd();

// Blocked directories — never allow access to these
const BLOCKED_PATHS = [
  // System dirs (Linux/macOS)
  "/etc",
  "/root",
  "/var",
  "/sys",
  "/proc",
  "/boot",
  "/usr",
  "/sbin",
  "/bin",
  "/lib",
  "/lib64",
  "/opt",
  "/dev",
  "/run",
  "/tmp",
  "/snap",
  "/mnt",
  "/media",
  // macOS specific
  "/System",
  "/Library",
  "/Applications",
  "/Volumes",
  "/private/etc",
  "/private/var",
];

// Blocked directories inside home
const BLOCKED_HOME_DIRS = [
  ".ssh",
  ".gnupg",
  ".gpg",
  ".aws",
  ".azure",
  ".gcloud",
  ".docker",
  ".kube",
  ".config/gcloud",
  ".config/gh",
  ".password-store",
  ".local/share/keyrings",
  ".bashrc",
  ".zshrc",
  ".profile",
];

// Hard blocked file patterns — never read or write these (security-critical)
const BLOCKED_PATTERNS = [
  /\.pem$/, // SSL certificates / private keys
  /\.p12$/, // PKCS12 certificates
  /id_rsa/, // SSH keys
  /id_ed25519/, // SSH keys
  /id_ecdsa/, // SSH keys
  /id_dsa/, // SSH keys
  /\.ppk$/, // PuTTY private keys
];

// Sensitive file patterns — require user approval before access
const SENSITIVE_PATTERNS = [
  /\.env($|\.)/, // .env, .env.local, .env.production
  /\.key$/, // Private keys
  /credentials/i, // Credential files
  /secrets?\.ya?ml$/i, // K8s secrets
  /\.npmrc$/, // npm auth tokens
  /\.netrc$/, // network credentials
  /\.git\/config$/, // git config (may contain tokens)
  /\.git-credentials$/, // git credential store
  /auth.*\.json$/i, // auth config files
  /token/i, // files with "token" in name
  /password/i, // files with "password" in name
  /api[_-]?key/i, // API key files
];

// Max file size to read (500KB)
const MAX_FILE_SIZE = 500 * 1024;

export interface SandboxResult {
  allowed: boolean;
  requiresApproval?: boolean; // If true, user must approve before access
  reason?: string;
}

export function validatePath(filePath: string): SandboxResult {
  const absPath = resolve(CWD, filePath);
  const relPath = relative(CWD, absPath);
  const home = process.env.HOME ?? "";

  // Block path traversal outside CWD
  if (relPath.startsWith("..") || (!absPath.startsWith(CWD + sep) && absPath !== CWD)) {
    return {
      allowed: false,
      reason: "Access denied: path is outside working directory",
    };
  }

  // Resolve symlinks and re-check (if the path exists on disk)
  try {
    const realPath = realpathSync(absPath);
    if (!realPath.startsWith(CWD + sep) && realPath !== CWD) {
      return {
        allowed: false,
        reason: "Access denied: path resolves outside working directory",
      };
    }
  } catch {
    // Path doesn't exist yet (e.g. write_file) — the absPath check above is sufficient
  }

  // Block system directories
  for (const blocked of BLOCKED_PATHS) {
    if (absPath.startsWith(blocked + "/") || absPath === blocked) {
      return { allowed: false, reason: "Access denied: system directory" };
    }
  }

  // Block sensitive home directories
  if (home) {
    for (const dir of BLOCKED_HOME_DIRS) {
      const fullBlocked = resolve(home, dir);
      if (absPath.startsWith(fullBlocked + "/") || absPath === fullBlocked) {
        return { allowed: false, reason: "Access denied: sensitive directory" };
      }
    }
  }

  // Block critical file patterns (never allow)
  const name = basename(absPath);
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(name) || pattern.test(absPath)) {
      return { allowed: false, reason: "Access denied: critical security file" };
    }
  }

  // Check sensitive file patterns (require approval)
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(name) || pattern.test(absPath)) {
      return {
        allowed: true,
        requiresApproval: true,
        reason: "Warning: sensitive file detected",
      };
    }
  }

  // Block node_modules (too large, not useful)
  if (absPath.includes("/node_modules/")) {
    return { allowed: false, reason: "Access denied: node_modules directory" };
  }

  return { allowed: true };
}

export function validateFileSize(filePath: string): SandboxResult {
  try {
    const absPath = resolve(CWD, filePath);
    const stat = statSync(absPath);
    if (stat.size > MAX_FILE_SIZE) {
      const sizeKB = Math.round(stat.size / 1024);
      return {
        allowed: false,
        reason: `File too large: ${sizeKB}KB (max ${MAX_FILE_SIZE / 1024}KB)`,
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: true }; // Let the actual read handle the error
  }
}

export function getWorkingDirectory(): string {
  return CWD;
}
