/**
 * Utility for exporting and importing backup data securely.
 * Uses a standard XOR cipher on UTF-8 bytes and safe Base64 encoding.
 * Signed with a checksum to detect modification or corruption.
 */

const BACKUP_KEY = "OshiDexBackupKey48";

/**
 * Calculates a simple but effective checksum of a string.
 */
function calculateChecksum(str) {
  let checksum = 0;
  for (let i = 0; i < str.length; i++) {
    checksum = (checksum + str.charCodeAt(i) * (i + 1)) % 1000000;
  }
  return checksum;
}

/**
 * Encrypts a plain text string into an obfuscated and signed Base64 backup payload.
 * @param {string} dataStr 
 * @returns {string}
 */
export function simpleEncrypt(dataStr) {
  const checksum = calculateChecksum(dataStr);
  const payload = JSON.stringify({ d: dataStr, c: checksum });
  
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);
  const keyBytes = encoder.encode(BACKUP_KEY);
  
  const encryptedBytes = new Uint8Array(payloadBytes.length);
  for (let i = 0; i < payloadBytes.length; i++) {
    encryptedBytes[i] = payloadBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  // Convert byte array to safe base64
  let binary = "";
  const len = encryptedBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(encryptedBytes[i]);
  }
  return btoa(binary);
}

/**
 * Decrypts and verifies a Base64 backup payload back to the original plain text.
 * Throws an error if the payload is modified or corrupted.
 * @param {string} encryptedStr 
 * @returns {string}
 */
export function simpleDecrypt(encryptedStr) {
  try {
    const binary = atob(encryptedStr);
    const len = binary.length;
    const encryptedBytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      encryptedBytes[i] = binary.charCodeAt(i);
    }
    
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(BACKUP_KEY);
    const payloadBytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      payloadBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    const decoder = new TextDecoder();
    const decrypted = decoder.decode(payloadBytes);
    
    const { d: dataStr, c: expectedChecksum } = JSON.parse(decrypted);
    
    // Verify checksum to ensure data integrity
    const checksum = calculateChecksum(dataStr);
    if (checksum !== expectedChecksum) {
      throw new Error("Checksum verification failed.");
    }
    
    return dataStr;
  } catch (e) {
    throw new Error("Decryption failed. The backup data is invalid or has been modified.");
  }
}

// ─── Encrypted localStorage Helpers ─────────────────────────────────────────

/**
 * Encrypts a value and stores it in localStorage.
 * @param {string} key
 * @param {any} value  (will be JSON-serialised before encryption)
 */
export function lsSetEncrypted(key, value) {
  try {
    localStorage.setItem(key, simpleEncrypt(JSON.stringify(value)))
  } catch {}
}

/**
 * Reads and decrypts a value from localStorage.
 * Gracefully falls back to plain JSON parse (migration from unencrypted storage),
 * then to `fallback` if both fail.
 * @param {string} key
 * @param {any} fallback  returned when key is missing or unreadable
 * @returns {any}
 */
export function lsGetDecrypted(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null || raw === undefined) return fallback

    // Try decryption first (encrypted storage)
    try {
      return JSON.parse(simpleDecrypt(raw))
    } catch {
      // Fallback: plain JSON for existing users migrating from unencrypted storage
      return JSON.parse(raw)
    }
  } catch {
    return fallback
  }
}

