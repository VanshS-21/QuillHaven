/**
 * Secure storage utilities for sensitive data like authentication tokens
 * Provides encryption and secure storage mechanisms for client-side data
 */

interface StorageOptions {
  encrypt?: boolean;
  expiresAt?: number;
  namespace?: string;
}

interface StoredData {
  value: string;
  encrypted: boolean;
  expiresAt?: number;
  timestamp: number;
}

class SecureStorage {
  private readonly namespace: string;
  private readonly encryptionKey: string;

  constructor(namespace = 'quillhaven') {
    this.namespace = namespace;
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  /**
   * Get or create encryption key for client-side encryption
   */
  private getOrCreateEncryptionKey(): string {
    const keyName = `${this.namespace}_encryption_key`;
    let key = localStorage.getItem(keyName);
    
    if (!key) {
      // Generate a simple key for client-side obfuscation
      // Note: This is not cryptographically secure, just obfuscation
      key = this.generateSimpleKey();
      localStorage.setItem(keyName, key);
    }
    
    return key;
  }

  /**
   * Generate a simple key for basic obfuscation
   */
  private generateSimpleKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Simple XOR encryption for basic obfuscation
   * Note: This is not cryptographically secure, just prevents casual inspection
   */
  private simpleEncrypt(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return btoa(result); // Base64 encode
  }

  /**
   * Simple XOR decryption
   */
  private simpleDecrypt(encryptedText: string, key: string): string {
    try {
      const decoded = atob(encryptedText); // Base64 decode
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
      }
      return result;
    } catch {
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Store data securely
   */
  setItem(key: string, value: string, options: StorageOptions = {}): void {
    const {
      encrypt = true,
      expiresAt,
      namespace = this.namespace,
    } = options;

    const fullKey = `${namespace}_${key}`;
    
    const storedData: StoredData = {
      value: encrypt ? this.simpleEncrypt(value, this.encryptionKey) : value,
      encrypted: encrypt,
      expiresAt,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(fullKey, JSON.stringify(storedData));
    } catch (error) {
      console.error('Failed to store data:', error);
      throw new Error('Storage failed - quota may be exceeded');
    }
  }

  /**
   * Retrieve data securely
   */
  getItem(key: string, namespace = this.namespace): string | null {
    const fullKey = `${namespace}_${key}`;
    
    try {
      const storedItem = localStorage.getItem(fullKey);
      if (!storedItem) {
        return null;
      }

      const storedData: StoredData = JSON.parse(storedItem);
      
      // Check expiration
      if (storedData.expiresAt && Date.now() > storedData.expiresAt) {
        this.removeItem(key, namespace);
        return null;
      }

      // Decrypt if needed
      if (storedData.encrypted) {
        return this.simpleDecrypt(storedData.value, this.encryptionKey);
      }

      return storedData.value;
    } catch (error) {
      console.error('Failed to retrieve data:', error);
      // Clean up corrupted data
      this.removeItem(key, namespace);
      return null;
    }
  }

  /**
   * Remove stored data
   */
  removeItem(key: string, namespace = this.namespace): void {
    const fullKey = `${namespace}_${key}`;
    localStorage.removeItem(fullKey);
  }

  /**
   * Check if item exists and is not expired
   */
  hasItem(key: string, namespace = this.namespace): boolean {
    return this.getItem(key, namespace) !== null;
  }

  /**
   * Clear all items in namespace
   */
  clear(namespace = this.namespace): void {
    const prefix = `${namespace}_`;
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Get all keys in namespace
   */
  getKeys(namespace = this.namespace): string[] {
    const prefix = `${namespace}_`;
    const keys: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }
    
    return keys;
  }

  /**
   * Clean up expired items
   */
  cleanupExpired(namespace = this.namespace): void {
    const keys = this.getKeys(namespace);
    
    keys.forEach(key => {
      // This will automatically remove expired items
      this.getItem(key, namespace);
    });
  }

  /**
   * Get storage usage information
   */
  getStorageInfo(): { used: number; available: number; percentage: number } {
    let used = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      }
    }

    // Estimate available space (most browsers have ~5-10MB limit)
    const estimated = 5 * 1024 * 1024; // 5MB estimate
    const available = Math.max(0, estimated - used);
    const percentage = (used / estimated) * 100;

    return {
      used,
      available,
      percentage: Math.min(100, percentage),
    };
  }
}

// Create singleton instance
export const secureStorage = new SecureStorage();

/**
 * Token-specific storage utilities
 */
export class TokenStorage {
  private storage: SecureStorage;

  constructor() {
    this.storage = secureStorage;
  }

  /**
   * Store authentication token with expiration
   */
  storeToken(token: string, expiresAt?: number): void {
    this.storage.setItem('auth_token', token, {
      encrypt: true,
      expiresAt,
    });
  }

  /**
   * Get authentication token
   */
  getToken(): string | null {
    return this.storage.getItem('auth_token');
  }

  /**
   * Remove authentication token
   */
  removeToken(): void {
    this.storage.removeItem('auth_token');
  }

  /**
   * Store user data
   */
  storeUser(userData: object): void {
    this.storage.setItem('user_data', JSON.stringify(userData), {
      encrypt: true,
    });
  }

  /**
   * Get user data
   */
  getUser<T = any>(): T | null {
    const userData = this.storage.getItem('user_data');
    if (!userData) return null;
    
    try {
      return JSON.parse(userData);
    } catch {
      this.storage.removeItem('user_data');
      return null;
    }
  }

  /**
   * Remove user data
   */
  removeUser(): void {
    this.storage.removeItem('user_data');
  }

  /**
   * Clear all authentication data
   */
  clearAuth(): void {
    this.removeToken();
    this.removeUser();
    this.storage.removeItem('refresh_token');
    this.storage.removeItem('session_data');
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    return this.storage.hasItem('auth_token');
  }
}

export const tokenStorage = new TokenStorage();

/**
 * Session storage utilities for temporary data
 */
export class SessionStorage {
  private readonly namespace: string;

  constructor(namespace = 'quillhaven_session') {
    this.namespace = namespace;
  }

  setItem(key: string, value: string): void {
    const fullKey = `${this.namespace}_${key}`;
    try {
      sessionStorage.setItem(fullKey, value);
    } catch (error) {
      console.error('Failed to store session data:', error);
    }
  }

  getItem(key: string): string | null {
    const fullKey = `${this.namespace}_${key}`;
    try {
      return sessionStorage.getItem(fullKey);
    } catch (error) {
      console.error('Failed to retrieve session data:', error);
      return null;
    }
  }

  removeItem(key: string): void {
    const fullKey = `${this.namespace}_${key}`;
    sessionStorage.removeItem(fullKey);
  }

  clear(): void {
    const prefix = `${this.namespace}_`;
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  }
}

export const sessionStorage = new SessionStorage();