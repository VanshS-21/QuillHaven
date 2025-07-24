/**
 * Security configuration for QuillHaven platform
 * Defines security policies, limits, and settings
 */

export interface SecurityConfig {
  session: SessionSecurityConfig
  authentication: AuthSecurityConfig
  rateLimit: RateLimitConfig
  monitoring: MonitoringConfig
  compliance: ComplianceConfig
}

export interface SessionSecurityConfig {
  maxConcurrentSessions: number
  sessionTimeoutMinutes: number
  inactiveSessionTimeoutDays: number
  requireReauthenticationHours: number
  suspiciousLoginThreshold: number
  maxLoginAttemptsPerHour: number
  sessionCleanupIntervalHours: number
}

export interface AuthSecurityConfig {
  passwordMinLength: number
  passwordRequireSpecialChars: boolean
  passwordRequireNumbers: boolean
  passwordRequireUppercase: boolean
  twoFactorRequired: boolean
  twoFactorGracePeriodDays: number
  accountLockoutAttempts: number
  accountLockoutDurationMinutes: number
}

export interface RateLimitConfig {
  apiRequestsPerMinute: number
  authRequestsPerMinute: number
  passwordResetRequestsPerHour: number
  profileUpdateRequestsPerHour: number
  fileUploadRequestsPerHour: number
}

export interface MonitoringConfig {
  logSecurityEvents: boolean
  alertOnSuspiciousActivity: boolean
  retainSecurityLogsMonths: number
  enableRealTimeMonitoring: boolean
  suspiciousActivityThreshold: number
}

export interface ComplianceConfig {
  gdprEnabled: boolean
  ccpaEnabled: boolean
  dataRetentionMonths: number
  auditLogRetentionYears: number
  encryptionRequired: boolean
  anonymizeDeletedUsers: boolean
}

/**
 * Default security configuration
 * Can be overridden by environment variables
 */
export const defaultSecurityConfig: SecurityConfig = {
  session: {
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5'),
    sessionTimeoutMinutes: parseInt(
      process.env.SESSION_TIMEOUT_MINUTES || '1440'
    ), // 24 hours
    inactiveSessionTimeoutDays: parseInt(
      process.env.INACTIVE_SESSION_TIMEOUT_DAYS || '30'
    ),
    requireReauthenticationHours: parseInt(
      process.env.REQUIRE_REAUTH_HOURS || '168'
    ), // 7 days
    suspiciousLoginThreshold: parseInt(
      process.env.SUSPICIOUS_LOGIN_THRESHOLD || '3'
    ),
    maxLoginAttemptsPerHour: parseInt(
      process.env.MAX_LOGIN_ATTEMPTS_PER_HOUR || '10'
    ),
    sessionCleanupIntervalHours: parseInt(
      process.env.SESSION_CLEANUP_INTERVAL_HOURS || '24'
    ),
  },
  authentication: {
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
    passwordRequireSpecialChars:
      process.env.PASSWORD_REQUIRE_SPECIAL_CHARS === 'true',
    passwordRequireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS === 'true',
    passwordRequireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE === 'true',
    twoFactorRequired: process.env.TWO_FACTOR_REQUIRED === 'true',
    twoFactorGracePeriodDays: parseInt(
      process.env.TWO_FACTOR_GRACE_PERIOD_DAYS || '30'
    ),
    accountLockoutAttempts: parseInt(
      process.env.ACCOUNT_LOCKOUT_ATTEMPTS || '5'
    ),
    accountLockoutDurationMinutes: parseInt(
      process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || '30'
    ),
  },
  rateLimit: {
    apiRequestsPerMinute: parseInt(
      process.env.API_REQUESTS_PER_MINUTE || '100'
    ),
    authRequestsPerMinute: parseInt(
      process.env.AUTH_REQUESTS_PER_MINUTE || '10'
    ),
    passwordResetRequestsPerHour: parseInt(
      process.env.PASSWORD_RESET_REQUESTS_PER_HOUR || '3'
    ),
    profileUpdateRequestsPerHour: parseInt(
      process.env.PROFILE_UPDATE_REQUESTS_PER_HOUR || '20'
    ),
    fileUploadRequestsPerHour: parseInt(
      process.env.FILE_UPLOAD_REQUESTS_PER_HOUR || '50'
    ),
  },
  monitoring: {
    logSecurityEvents: process.env.LOG_SECURITY_EVENTS !== 'false',
    alertOnSuspiciousActivity:
      process.env.ALERT_ON_SUSPICIOUS_ACTIVITY !== 'false',
    retainSecurityLogsMonths: parseInt(
      process.env.RETAIN_SECURITY_LOGS_MONTHS || '12'
    ),
    enableRealTimeMonitoring:
      process.env.ENABLE_REAL_TIME_MONITORING !== 'false',
    suspiciousActivityThreshold: parseInt(
      process.env.SUSPICIOUS_ACTIVITY_THRESHOLD || '5'
    ),
  },
  compliance: {
    gdprEnabled: process.env.GDPR_ENABLED !== 'false',
    ccpaEnabled: process.env.CCPA_ENABLED !== 'false',
    dataRetentionMonths: parseInt(process.env.DATA_RETENTION_MONTHS || '84'), // 7 years
    auditLogRetentionYears: parseInt(
      process.env.AUDIT_LOG_RETENTION_YEARS || '7'
    ),
    encryptionRequired: process.env.ENCRYPTION_REQUIRED !== 'false',
    anonymizeDeletedUsers: process.env.ANONYMIZE_DELETED_USERS !== 'false',
  },
}

/**
 * Get security configuration with environment overrides
 */
export function getSecurityConfig(): SecurityConfig {
  return defaultSecurityConfig
}

/**
 * Security policy definitions
 */
export const securityPolicies = {
  /**
   * Check if session count exceeds limit
   */
  isSessionLimitExceeded: (sessionCount: number): boolean => {
    return sessionCount > defaultSecurityConfig.session.maxConcurrentSessions
  },

  /**
   * Check if session is expired
   */
  isSessionExpired: (lastActiveAt: Date): boolean => {
    const timeoutMs =
      defaultSecurityConfig.session.sessionTimeoutMinutes * 60 * 1000
    return Date.now() - lastActiveAt.getTime() > timeoutMs
  },

  /**
   * Check if session is stale (inactive for too long)
   */
  isSessionStale: (lastActiveAt: Date): boolean => {
    const timeoutMs =
      defaultSecurityConfig.session.inactiveSessionTimeoutDays *
      24 *
      60 *
      60 *
      1000
    return Date.now() - lastActiveAt.getTime() > timeoutMs
  },

  /**
   * Check if login attempt is suspicious
   */
  isSuspiciousLogin: (factors: string[]): boolean => {
    return (
      factors.length >= defaultSecurityConfig.session.suspiciousLoginThreshold
    )
  },

  /**
   * Check if rate limit is exceeded
   */
  isRateLimitExceeded: (
    requestCount: number,
    limitType: keyof RateLimitConfig
  ): boolean => {
    const limit = defaultSecurityConfig.rateLimit[limitType]
    return requestCount > limit
  },

  /**
   * Check if two-factor authentication is required
   */
  isTwoFactorRequired: (userCreatedAt: Date): boolean => {
    if (!defaultSecurityConfig.authentication.twoFactorRequired) {
      return false
    }

    const gracePeriodMs =
      defaultSecurityConfig.authentication.twoFactorGracePeriodDays *
      24 *
      60 *
      60 *
      1000
    return Date.now() - userCreatedAt.getTime() > gracePeriodMs
  },
}

/**
 * Security headers configuration
 */
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.accounts.dev",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.clerk.com https://*.clerk.accounts.dev https://clerk.com",
    "frame-src 'self' https://clerk.com https://*.clerk.accounts.dev",
  ].join('; '),
}

/**
 * CORS configuration
 */
export const corsConfig = {
  origin: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ...(process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_ORIGINS?.split(',') || []),
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
}

/**
 * Encryption configuration
 */
export const encryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  saltLength: 32,
  iterations: 100000,
}

/**
 * Audit log configuration
 */
export const auditConfig = {
  enableAuditLogs: process.env.ENABLE_AUDIT_LOGS !== 'false',
  auditableEvents: [
    'user_created',
    'user_updated',
    'user_deleted',
    'role_changed',
    'session_created',
    'session_ended',
    'two_factor_enabled',
    'two_factor_disabled',
    'password_changed',
    'suspicious_login',
    'unauthorized_access_attempt',
    'data_exported',
    'profile_synced',
  ],
  sensitiveFields: ['password', 'token', 'secret', 'key', 'ssn', 'credit_card'],
}

/**
 * Get security level based on environment
 */
export function getSecurityLevel(): 'development' | 'staging' | 'production' {
  const level =
    process.env.NEXT_PUBLIC_SECURITY_LEVEL ||
    process.env.NODE_ENV ||
    'development'

  if (['production', 'staging', 'development'].includes(level)) {
    return level as 'development' | 'staging' | 'production'
  }

  return 'development'
}

/**
 * Check if security feature is enabled for current environment
 */
export function isSecurityFeatureEnabled(feature: string): boolean {
  const securityLevel = getSecurityLevel()

  const featureConfig: Record<string, string[]> = {
    two_factor_enforcement: ['production'],
    session_monitoring: ['staging', 'production'],
    real_time_alerts: ['production'],
    audit_logging: ['staging', 'production'],
    rate_limiting: ['staging', 'production'],
    security_headers: ['staging', 'production'],
  }

  return featureConfig[feature]?.includes(securityLevel) ?? false
}
