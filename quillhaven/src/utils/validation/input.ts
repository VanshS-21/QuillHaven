/**
 * Input validation and sanitization utilities
 */

import DOMPurify from 'isomorphic-dompurify';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: unknown;
  sanitized?: Record<string, any>;
  wordCount?: number;
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
  const sanitizedData = value?.toString().trim() || '';

  // Required validation
  if (options.required && !sanitizedData) {
    errors.push(`${fieldName} is required`);
  }

  // Length validation
  if (
    sanitizedData &&
    options.minLength &&
    sanitizedData.length < options.minLength
  ) {
    errors.push(
      `${fieldName} must be at least ${options.minLength} characters long`
    );
  }

  if (
    sanitizedData &&
    options.maxLength &&
    sanitizedData.length > options.maxLength
  ) {
    errors.push(
      `${fieldName} must be no more than ${options.maxLength} characters long`
    );
  }

  // Pattern validation
  if (
    sanitizedData &&
    options.pattern &&
    !options.pattern.test(sanitizedData)
  ) {
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
  if (
    options.required &&
    (value === undefined || value === null || value === '')
  ) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  // Check if it's a valid number
  if (
    value !== undefined &&
    value !== null &&
    value !== '' &&
    isNaN(numValue)
  ) {
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
 * Sanitize HTML content to prevent XSS attacks while preserving safe formatting
 * Optimized for performance with large text inputs
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Performance optimization: limit input size to prevent DoS attacks
  const MAX_HTML_LENGTH = 1000000; // 1MB limit
  if (html.length > MAX_HTML_LENGTH) {
    throw new Error('HTML content too large for sanitization');
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'div',
      'span',
    ],
    ALLOWED_ATTR: ['href', 'alt', 'title'],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: [
      'onclick',
      'onload',
      'onerror',
      'onmouseover',
      'onfocus',
      'onblur',
    ],
    FORBID_TAGS: [
      'script',
      'object',
      'embed',
      'form',
      'input',
      'textarea',
      'select',
      'button',
    ],
  });
}

/**
 * Sanitize plain text by removing control characters and normalizing whitespace
 */
export function sanitizeText(text: string): string {
  return (
    text
      // Remove control characters (except newlines and tabs)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
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

      if (privatePatterns.some((pattern) => pattern.test(hostname))) {
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

// Project and Chapter Validation Interfaces
export interface ProjectData {
  title: string;
  description?: string;
  genre: string;
  targetLength: number;
}

export interface ChapterData {
  title: string;
  content: string;
}

export interface ExportRequest {
  projectId: string;
  format: 'pdf' | 'docx' | 'txt' | 'epub';
  includeMetadata?: boolean;
  chapterIds?: string[];
}

// Valid genres list
const VALID_GENRES = [
  'Fantasy',
  'Science Fiction',
  'Mystery',
  'Romance',
  'Thriller',
  'Horror',
  'Historical Fiction',
  'Literary Fiction',
  'Young Adult',
  'Children',
  'Non-Fiction',
  'Biography',
  'Memoir',
  'Self-Help',
  'Business',
  'Health',
  'Travel',
  'Cooking',
  'Art',
  'Religion',
  'Philosophy',
  'Poetry',
  'Drama',
  'Comedy',
  'Adventure',
  'Western',
  'Crime',
  'Dystopian',
  'Utopian',
  'Alternate History',
  'Steampunk',
  'Cyberpunk',
  'Urban Fantasy',
  'Paranormal',
  'Contemporary',
  'Classic',
  'Experimental',
  'Other',
];

// Performance and security constants
const MAX_INPUT_LENGTH = 100000; // 100KB limit for text inputs
const REDOS_TIMEOUT = 1000; // 1 second timeout for regex operations

/**
 * Safe regex execution with timeout to prevent ReDoS attacks
 */
function safeRegexTest(
  pattern: RegExp,
  text: string,
  timeoutMs: number = REDOS_TIMEOUT
): boolean {
  const startTime = Date.now();

  try {
    // Simple length check to prevent obvious ReDoS attempts
    if (text.length > MAX_INPUT_LENGTH) {
      return false;
    }

    const result = pattern.test(text);

    // Check if execution took too long
    if (Date.now() - startTime > timeoutMs) {
      console.warn('Regex execution timeout detected, possible ReDoS attack');
      return false;
    }

    return result;
  } catch (error) {
    console.warn('Regex execution error:', error);
    return false;
  }
}

/**
 * Validate project data with comprehensive validation rules
 * Includes performance optimizations and ReDoS attack prevention
 */
export function validateProjectData(data: ProjectData): ValidationResult {
  const errors: Record<string, string[]> = {};
  const sanitized: Record<string, any> = {};

  // Performance check: prevent processing of extremely large inputs
  const totalInputSize =
    (data.title?.length || 0) +
    (data.description?.length || 0) +
    (data.genre?.length || 0);
  if (totalInputSize > MAX_INPUT_LENGTH) {
    return {
      isValid: false,
      errors: ['Input data too large'],
    };
  }

  // Validate title
  if (!data.title || !data.title.trim()) {
    errors.title = ['Title is required'];
  } else {
    const title = data.title.trim();
    if (title.length > 200) {
      errors.title = ['Title must be less than 200 characters'];
    } else {
      try {
        // Sanitize HTML in title with error handling
        sanitized.title = sanitizeHtml(title);
      } catch (error) {
        errors.title = ['Title contains invalid content'];
      }
    }
  }

  // Validate description (optional)
  if (data.description !== undefined) {
    if (data.description.length > 1000) {
      errors.description = ['Description must be less than 1000 characters'];
    } else {
      try {
        // Sanitize HTML in description with error handling
        sanitized.description = sanitizeHtml(data.description);
      } catch (error) {
        errors.description = ['Description contains invalid content'];
      }
    }
  }

  // Validate genre
  if (!data.genre || !data.genre.trim()) {
    errors.genre = ['Genre is required'];
  } else {
    const genre = data.genre.trim();
    if (genre.length > 50) {
      errors.genre = ['Genre must be less than 50 characters'];
    } else if (!VALID_GENRES.includes(genre)) {
      errors.genre = ['Invalid genre selected'];
    } else {
      sanitized.genre = genre;
    }
  }

  // Validate target length
  if (typeof data.targetLength !== 'number' || isNaN(data.targetLength)) {
    errors.targetLength = ['Target length must be a valid number'];
  } else if (data.targetLength <= 0) {
    errors.targetLength = ['Target length must be greater than 0'];
  } else if (data.targetLength > 5000000) {
    errors.targetLength = ['Target length must be less than 5,000,000 words'];
  } else {
    sanitized.targetLength = data.targetLength;
  }

  const hasErrors = Object.keys(errors).length > 0;
  
  // Flatten errors to match ValidationResult interface
  const flatErrors: string[] = [];
  if (hasErrors) {
    for (const fieldErrors of Object.values(errors)) {
      flatErrors.push(...fieldErrors);
    }
  }

  return {
    isValid: !hasErrors,
    errors: flatErrors,
    sanitized: hasErrors ? undefined : sanitized,
  };
}

/**
 * Validate chapter data with content validation
 * Includes performance optimizations for large text processing
 */
export function validateChapterData(data: ChapterData): ValidationResult {
  const errors: Record<string, string[]> = {};
  const sanitized: Record<string, any> = {};

  // Validate title
  if (!data.title || !data.title.trim()) {
    errors.title = ['Title is required'];
  } else {
    const title = data.title.trim();
    if (title.length > 300) {
      errors.title = ['Title must be less than 300 characters'];
    } else {
      try {
        sanitized.title = sanitizeHtml(title);
      } catch (error) {
        errors.title = ['Title contains invalid content'];
      }
    }
  }

  // Validate content
  if (!data.content || !data.content.trim()) {
    errors.content = ['Content is required'];
  } else {
    const content = data.content.trim();
    if (content.length > 100000) {
      errors.content = ['Content must be less than 100,000 characters'];
    } else {
      try {
        // Sanitize HTML in content, preserving safe formatting tags
        sanitized.content = sanitizeHtml(content);
      } catch (error) {
        errors.content = ['Content contains invalid content'];
      }
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  
  // Flatten errors to match ValidationResult interface
  const flatErrors: string[] = [];
  if (hasErrors) {
    for (const fieldErrors of Object.values(errors)) {
      flatErrors.push(...fieldErrors);
    }
  }

  // Calculate word count with performance optimization
  let wordCount = 0;
  if (data.content && !hasErrors) {
    try {
      wordCount = validateWordCount(data.content);
    } catch (error) {
      console.warn('Word count calculation failed:', error);
      wordCount = 0;
    }
  }

  return {
    isValid: !hasErrors,
    errors: flatErrors,
    sanitized: hasErrors ? undefined : sanitized,
    wordCount,
  };
}

/**
 * Validate export request data
 */
export function validateExportRequest(data: ExportRequest): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Validate project ID
  if (!data.projectId || !data.projectId.trim()) {
    errors.projectId = ['Project ID is required'];
  }

  // Validate format
  const validFormats = ['pdf', 'docx', 'txt', 'epub'];
  if (!data.format || !validFormats.includes(data.format)) {
    errors.format = ['Format must be one of: pdf, docx, txt, epub'];
  }

  // Validate includeMetadata (optional boolean)
  if (
    data.includeMetadata !== undefined &&
    typeof data.includeMetadata !== 'boolean'
  ) {
    errors.includeMetadata = ['Include metadata must be a boolean value'];
  }

  // Validate chapter IDs (optional array)
  if (data.chapterIds !== undefined) {
    if (!Array.isArray(data.chapterIds)) {
      errors.chapterIds = ['Chapter IDs must be an array'];
    } else if (data.chapterIds.length === 0) {
      errors.chapterIds = ['Chapter IDs array cannot be empty'];
    } else {
      // Check for empty strings in array
      const hasEmptyIds = data.chapterIds.some((id) => !id || !id.trim());
      if (hasEmptyIds) {
        errors.chapterIds = ['Chapter IDs cannot contain empty values'];
      }
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  
  // Flatten errors to match ValidationResult interface
  const flatErrors: string[] = [];
  if (hasErrors) {
    for (const fieldErrors of Object.values(errors)) {
      flatErrors.push(...fieldErrors);
    }
  }

  return {
    isValid: !hasErrors,
    errors: flatErrors,
  };
}

/**
 * Count words in text accurately with performance optimization
 * Handles Unicode characters, contractions, and hyphens properly
 */
export function validateWordCount(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Performance optimization: limit text size
  if (text.length > MAX_INPUT_LENGTH) {
    throw new Error('Text too large for word counting');
  }

  // Remove HTML tags for accurate word counting (optimized regex)
  const plainText = text.replace(/<[^>]*?>/g, '');

  // Handle empty or whitespace-only text
  if (!plainText.trim()) {
    return 0;
  }

  // Performance optimization: use simpler regex for very large texts
  if (plainText.length > 50000) {
    // For large texts, use a simpler but faster approach
    const words = plainText
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    return words.length;
  }

  // Split by word boundaries to handle contractions, hyphens, and Unicode properly
  // This regex matches sequences of word characters including Unicode letters
  const words = plainText.match(
    /[\w\u00C0-\u024F\u1E00-\u1EFF\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u4E00-\u9FFF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1F\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g
  );

  return words ? words.length : 0;
}

/**
 * Validate file size with configurable limits
 */
export function validateFileSize(
  size: number,
  maxSize: number = 5 * 1024 * 1024
): boolean {
  if (typeof size !== 'number' || size <= 0) {
    return false;
  }

  return size <= maxSize;
}

/**
 * Validate image upload with comprehensive checks
 */
export function validateImageUpload(file: any): ValidationResult {
  const errors: string[] = [];

  // Check if file object has required properties
  if (!file || typeof file !== 'object') {
    errors.push('Invalid file object');
    return { isValid: false, errors };
  }

  if (!file.name || typeof file.name !== 'string') {
    errors.push('File name is required');
  }

  if (!file.type || typeof file.type !== 'string') {
    errors.push('File type is required');
  }

  if (typeof file.size !== 'number') {
    errors.push('File size is required');
  }

  // If basic properties are missing, return early
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Validate file type
  const validImageTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  if (!validImageTypes.includes(file.type)) {
    errors.push('File must be an image');
  }

  // Validate file size (10MB limit for images)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    errors.push('File size must be less than 10MB');
  }

  // Validate file extension
  const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (!fileExtension || !validExtensions.includes(fileExtension)) {
    errors.push('Invalid file extension');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
