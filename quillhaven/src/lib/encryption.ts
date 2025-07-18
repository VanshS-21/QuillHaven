/**
 * Data encryption and decryption utilities for sensitive user content
 */

import crypto from 'crypto';

// Encryption configuration
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

// Get encryption key from environment or generate one
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? process.env.ENCRYPTION_KEY
  : crypto.randomBytes(KEY_LENGTH).toString('hex');

if (!process.env.ENCRYPTION_KEY) {
  console.warn(
    'ENCRYPTION_KEY not set in environment. Using temporary key. Data will not persist across restarts.'
  );
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  salt?: string;
}

/**
 * Derive encryption key from password using PBKDF2
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt sensitive text data
 */
export function encryptText(
  plaintext: string,
  userKey?: string
): EncryptedData {
  try {
    let keyBuffer: Buffer;
    let salt: Buffer | undefined = undefined;

    // If user-specific key is provided, derive key from it
    if (userKey) {
      salt = crypto.randomBytes(SALT_LENGTH);
      keyBuffer = deriveKey(userKey, salt);
    } else {
      keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      keyBuffer.subarray(0, 32),
      iv
    );

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: '', // Not used in CBC mode
      salt: salt?.toString('hex'),
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive text data
 */
export function decryptText(
  encryptedData: EncryptedData,
  userKey?: string
): string {
  try {
    let keyBuffer: Buffer;

    // If user-specific key was used, derive it again
    if (userKey && encryptedData.salt) {
      const salt = Buffer.from(encryptedData.salt, 'hex');
      keyBuffer = deriveKey(userKey, salt);
    } else {
      keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
    }

    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      keyBuffer.subarray(0, 32),
      iv
    );

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt JSON data
 */
export function encryptJSON(data: unknown, userKey?: string): EncryptedData {
  const jsonString = JSON.stringify(data);
  return encryptText(jsonString, userKey);
}

/**
 * Decrypt JSON data
 */
export function decryptJSON<T = unknown>(
  encryptedData: EncryptedData,
  userKey?: string
): T {
  const jsonString = decryptText(encryptedData, userKey);
  return JSON.parse(jsonString) as T;
}

/**
 * Hash sensitive data for comparison (one-way)
 */
export function hashData(
  data: string,
  salt?: string
): { hash: string; salt: string } {
  const saltBuffer = salt
    ? Buffer.from(salt, 'hex')
    : crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(data, saltBuffer, 100000, 64, 'sha256');

  return {
    hash: hash.toString('hex'),
    salt: saltBuffer.toString('hex'),
  };
}

/**
 * Verify hashed data
 */
export function verifyHashedData(
  data: string,
  hash: string,
  salt: string
): boolean {
  try {
    const { hash: computedHash } = hashData(data, salt);
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(computedHash, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate cryptographically secure random string
 */
export function generateSecureString(length: number = 16): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    result += chars[randomIndex];
  }

  return result;
}

/**
 * Encrypt file buffer
 */
export function encryptBuffer(buffer: Buffer, userKey?: string): EncryptedData {
  const base64Data = buffer.toString('base64');
  return encryptText(base64Data, userKey);
}

/**
 * Decrypt file buffer
 */
export function decryptBuffer(
  encryptedData: EncryptedData,
  userKey?: string
): Buffer {
  const base64Data = decryptText(encryptedData, userKey);
  return Buffer.from(base64Data, 'base64');
}

/**
 * Encrypt user content with automatic key derivation
 */
export class UserContentEncryption {
  private userKey: string;

  constructor(userId: string, userSecret?: string) {
    // Derive user-specific key from user ID and optional secret
    const baseKey =
      userSecret || process.env.USER_ENCRYPTION_SECRET || 'default-user-secret';
    this.userKey = crypto
      .createHash('sha256')
      .update(`${userId}:${baseKey}`)
      .digest('hex');
  }

  encryptContent(content: string): EncryptedData {
    return encryptText(content, this.userKey);
  }

  decryptContent(encryptedData: EncryptedData): string {
    return decryptText(encryptedData, this.userKey);
  }

  encryptJSON(data: unknown): EncryptedData {
    return encryptJSON(data, this.userKey);
  }

  decryptJSON<T = unknown>(encryptedData: EncryptedData): T {
    return decryptJSON<T>(encryptedData, this.userKey);
  }
}

/**
 * Secure data storage wrapper
 */
export class SecureStorage {
  private encryption: UserContentEncryption;

  constructor(userId: string, userSecret?: string) {
    this.encryption = new UserContentEncryption(userId, userSecret);
  }

  /**
   * Store encrypted data
   */
  async storeEncrypted(key: string, data: unknown): Promise<string> {
    const encrypted = this.encryption.encryptJSON(data);
    // In a real implementation, you would store this in your database
    // For now, we return the encrypted data as a string
    return JSON.stringify(encrypted);
  }

  /**
   * Retrieve and decrypt data
   */
  async retrieveDecrypted<T = unknown>(
    encryptedDataString: string
  ): Promise<T> {
    const encryptedData = JSON.parse(encryptedDataString) as EncryptedData;
    return this.encryption.decryptJSON<T>(encryptedData);
  }
}

/**
 * Utility to check if data appears to be encrypted
 */
export function isEncrypted(data: unknown): data is EncryptedData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'encrypted' in data &&
    'iv' in data &&
    'tag' in data &&
    typeof (data as EncryptedData).encrypted === 'string' &&
    typeof (data as EncryptedData).iv === 'string' &&
    typeof (data as EncryptedData).tag === 'string'
  );
}

/**
 * Migrate unencrypted data to encrypted format
 */
export function migrateToEncrypted(
  data: string,
  userId: string,
  userSecret?: string
): EncryptedData {
  const encryption = new UserContentEncryption(userId, userSecret);
  return encryption.encryptContent(data);
}

/**
 * Key rotation utility
 */
export class KeyRotation {
  private oldKey: string;
  private newKey: string;

  constructor(oldKey: string, newKey: string) {
    this.oldKey = oldKey;
    this.newKey = newKey;
  }

  /**
   * Re-encrypt data with new key
   */
  rotateEncryption(encryptedData: EncryptedData): EncryptedData {
    // Decrypt with old key
    const plaintext = decryptText(encryptedData, this.oldKey);

    // Encrypt with new key
    return encryptText(plaintext, this.newKey);
  }

  /**
   * Batch rotate multiple encrypted items
   */
  batchRotate(encryptedItems: EncryptedData[]): EncryptedData[] {
    return encryptedItems.map((item) => this.rotateEncryption(item));
  }
}
