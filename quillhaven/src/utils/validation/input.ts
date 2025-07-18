/**
 * Input validation and sanitization utilities
 */

import DOMPurify from 'isomorphic-dompurify';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: string;
}

export interface ValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => string | null;
}

export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

/**
 * Validate and sanitize string input
 */
export function validateString(
  value: string,
  fieldName: string,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  let sanitizedData = value?.toString().trim() || '';

  // Required validation
  if (options.required && !sanitizedData) {
    errors.push(`${fieldName} is required`);
  }

  // Length validation
  if (sanitizedData && options.minLength && sanitizedData.length < options.minLength) {
    errors.push(`${fieldName} must be at least ${options.minLength} characters long`);
  }

  if (sanitizedData && options.maxLength && sanitizedData.length > options.maxLength) {
    errors.push(`${fieldName} must be no more than ${options.maxLength} characters long`);
  }

  // Pattern validation
  if (sanitizedData && options.pattern && !options.pattern.test(sanitizedData)) {
    errors.push(`${fieldName} format is invalid`);
  }

  // Custom validation
  if (sanitizedData && options.customValidator) {
    const customError = options.customValidator(sanitizedData);
    if (customError) {
      errors.push(customError);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedData : undefined,
  };
}

/**
 * Validate numeric input
 */
export function validateNumber(
  value: number | string,
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): ValidationResult {
  const errors: string[] = [];
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Required validation
  if (options.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  // Check if it's a valid number
  if (value !== undefined && value !== null && value !== '' && isNaN(numValue)) {
    errors.push(`${fieldName} must be a valid number`);
    return { isValid: false, errors };
  }

  if (!isNaN(numValue)) {
    // Integer validation
    if (options.integer && !Number.isInteger(numValue)) {
      errors.push(`${fieldName} must be an integer`);
    }

    // Range validation
    if (options.min !== undefined && numValue < options.min) {
      errors.push(`${fieldName} must be at least ${options.min}`);
    }

    if (options.max !== undefined && numValue > options.max) {
      errors.push(`${fieldName} must be no more than ${options.max}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? numValue.toString() : undefined,
  };
}

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'div', 'span'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize plain text by removing control characters and normalizing whitespace
 */
export function sanitizeText(text: string): string {
  return text
    // Remove control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validate database identifiers to prevent SQL injection
 */
export function validateDatabaseIdentifier(
  value: string,
  fieldName: string
): ValidationResult {
  const errors: string[] = [];
  
  // Allow only alphanumeric characters, underscores, and hyphens
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  
  if (!validPattern.test(value)) {
    errors.push(`${fieldName} contains invalid characters`);
  }

  // Check for SQL injection patterns
  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|")/,
    /(\bOR\b|\bAND\b).*[=<>]/i,
  ];

  for (const pattern of sqlInjectionPatterns) {
    if (pattern.test(value)) {
      errors.push(`${fieldName} contains potentially dangerous content`);
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? value : undefined,
  };
}

/**
 * Validate file uploads
 */
export function validateFileUpload(
  file: File,
  options: FileValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];

  // Size validation
  if (options.maxSize && file.size > options.maxSize) {
    const maxSizeMB = Math.round(options.maxSize / (1024 * 1024));
    errors.push(`File size must be less than ${maxSizeMB}MB`);
  }

  // Type validation
  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }

  // Extension validation
  if (options.allowedExtensions) {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !options.allowedExtensions.includes(fileExtension)) {
      errors.push(`File extension is not allowed`);
    }
  }

  // Check for potentially dangerous file names
  const dangerousPatterns = [
    /\.(exe|bat|cmd|com|pif|scr|vbs|js)$/i,
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(file.name)) {
      errors.push('File name or type is not allowed for security reasons');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate and sanitize URL input
 */
export function validateUrl(url: string, fieldName: string): ValidationResult {
  const errors: string[] = [];
  
  try {
    const urlObj = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      errors.push(`${fieldName} must use http or https protocol`);
    }
    
    // Prevent localhost and private IP ranges in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = urlObj.hostname.toLowerCase();
      const privatePatterns = [
        /^localhost$/,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
      ];
      
      if (privatePatterns.some(pattern => pattern.test(hostname))) {
        errors.push(`${fieldName} cannot reference private or local addresses`);
      }
    }
  } catch {
    errors.push(`${fieldName} is not a valid URL`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? url : undefined,
  };
}

/**
 * Rate limiting helper
 */
export class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  checkLimit(
    key: string,
    maxRequests: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      this.store.set(key, entry);
    }

    entry.count++;
    const remaining = Math.max(0, maxRequests - entry.count);
    const allowed = entry.count <= maxRequests;

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}