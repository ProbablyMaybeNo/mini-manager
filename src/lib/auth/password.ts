import bcrypt from "bcryptjs";

/**
 * Bcrypt cost factor. 10 is the conventional default — ~50 ms per hash
 * on commodity serverless. Higher costs (12+) push past the Vercel
 * Functions 100 ms budget on cold starts.
 */
const BCRYPT_COST = 10;

/** Hash a plaintext password with bcryptjs. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** Verify a plaintext password against a bcrypt hash. Returns false on
 *  any mismatch (including malformed hashes — bcryptjs throws and we
 *  swallow the throw so callers can treat this as a boolean check). */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
