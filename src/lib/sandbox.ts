import { resolve, relative, basename } from "node:path";
import { statSync } from "node:fs";

// Only allow access within the current working directory
const CWD = process.cwd();

// Blocked directories — never allow access to these
const BLOCKED_PATHS = [
  // System dirs (Linux/macOS)
  "/etc", "/root", "/var", "/sys", "/proc", "/boot",
  "/usr", "/sbin", "/bin", "/lib", "/lib64", "/opt",
  "/dev", "/run", "/tmp", "/snap", "/mnt", "/media",
  // macOS specific
  "/System", "/Library", "/Applications", "/Volumes",
  "/private/etc", "/private/var",
];

// Blocked directories inside home
const BLOCKED_HOME_DIRS = [
  ".ssh", ".gnupg", ".gpg", ".aws", ".azure", ".gcloud",
  ".docker", ".kube", ".config/gcloud", ".config/gh",
  ".password-store", ".local/share/keyrings",
  ".bashrc", ".zshrc", ".profile",
];

// Blocked file patterns — never read or write these
const BLOCKED_PATTERNS = [
  /\.env($|\.)/,          // .env, .env.local, .env.production
  /\.pem$/,               // SSL certificates / private keys
  /\.key$/,               // Private keys
  /\.p12$/,               // PKCS12 certificates
  /id_rsa/,               // SSH keys
  /id_ed25519/,           // SSH keys
  /credentials/i,         // Credential files
  /secrets?\.ya?ml$/i,    // K8s secrets
  /\.npmrc$/,             // npm auth tokens
  /\.netrc$/,             // network credentials
  /\.git\/config$/,       // git config (may contain tokens)
];

// Max file size to read (500KB)
const MAX_FILE_SIZE = 500 * 1024;

export interface SandboxResult {
  allowed: boolean;
  reason?: string;
}

export function validatePath(filePath: string): SandboxResult {
  const absPath = resolve(CWD, filePath);
  const relPath = relative(CWD, absPath);
  const home = process.env.HOME ?? "";

  // Block path traversal outside CWD
  if (relPath.startsWith("..") || resolve(absPath) !== absPath.replace(/\/$/, "")) {
    // Re-check: is it within CWD?
    if (!absPath.startsWith(CWD)) {
      return { allowed: false, reason: `Access denied: path is outside working directory (${CWD})` };
    }
  }

  // Block system directories
  for (const blocked of BLOCKED_PATHS) {
    if (absPath.startsWith(blocked + "/") || absPath === blocked) {
      return { allowed: false, reason: `Access denied: system directory (${blocked})` };
    }
  }

  // Block sensitive home directories
  if (home) {
    for (const dir of BLOCKED_HOME_DIRS) {
      const fullBlocked = resolve(home, dir);
      if (absPath.startsWith(fullBlocked + "/") || absPath === fullBlocked) {
        return { allowed: false, reason: `Access denied: sensitive directory (~/${dir})` };
      }
    }
  }

  // Block sensitive file patterns
  const name = basename(absPath);
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(name) || pattern.test(absPath)) {
      return { allowed: false, reason: `Access denied: sensitive file pattern (${name})` };
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
      return { allowed: false, reason: `File too large: ${sizeKB}KB (max ${MAX_FILE_SIZE / 1024}KB)` };
    }
    return { allowed: true };
  } catch {
    return { allowed: true }; // Let the actual read handle the error
  }
}

export function getWorkingDirectory(): string {
  return CWD;
}
