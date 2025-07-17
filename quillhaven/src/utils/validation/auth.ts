/**
 * Authentication validation utilities
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email) {
    errors.push('Email is required');
  } else {
    // More strict email validation
    // Check for basic format first
    if (
      !email.includes('@') ||
      email.indexOf('@') === 0 ||
      email.indexOf('@') === email.length - 1
    ) {
      errors.push('Please enter a valid email address');
    } else {
      const [localPart, ...domainParts] = email.split('@');

      // Should have exactly one @ symbol
      if (domainParts.length !== 1) {
        errors.push('Please enter a valid email address');
      } else {
        const domain = domainParts[0];

        // Validate local part (before @)
        if (!localPart || localPart.length === 0) {
          errors.push('Please enter a valid email address');
        } else {
          // Check for consecutive dots
          if (localPart.includes('..')) {
            errors.push('Please enter a valid email address');
          }

          // Check for spaces
          if (localPart.includes(' ')) {
            errors.push('Please enter a valid email address');
          }

          // Check for valid characters in local part
          if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
            errors.push('Please enter a valid email address');
          }

          // Local part cannot start or end with dot
          if (localPart.startsWith('.') || localPart.endsWith('.')) {
            errors.push('Please enter a valid email address');
          }
        }

        // Validate domain part (after @)
        if (!domain || domain.length === 0) {
          errors.push('Please enter a valid email address');
        } else {
          // Domain cannot start with dot
          if (domain.startsWith('.')) {
            errors.push('Please enter a valid email address');
          }

          // Domain must contain at least one dot for TLD
          if (!domain.includes('.')) {
            errors.push('Please enter a valid email address');
          }

          // Check for valid domain format
          if (
            !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
              domain
            )
          ) {
            errors.push('Please enter a valid email address');
          }
        }
      }
    }

    if (email.length > 254) {
      errors.push('Email address is too long');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
  } else {
    if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (password.length > 128) {
      errors.push('Password is too long (maximum 128 characters)');
    }

    // More lenient validation - just require some complexity
    let complexityScore = 0;
    
    if (/[a-z]/.test(password)) complexityScore++;
    if (/[A-Z]/.test(password)) complexityScore++;
    if (/\d/.test(password)) complexityScore++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) complexityScore++;

    if (complexityScore < 2) {
      errors.push('Password must contain at least two of: lowercase letters, uppercase letters, numbers, or special characters');
    }

    // Check for very common weak passwords only
    const veryCommonPasswords = [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
    ];

    if (veryCommonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a stronger password');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate name (first name or last name)
 */
export function validateName(
  name: string,
  fieldName: string = 'Name'
): ValidationResult {
  const errors: string[] = [];

  if (name && name.trim()) {
    const trimmedName = name.trim();

    if (trimmedName.length < 1) {
      errors.push(`${fieldName} cannot be empty`);
    }

    if (trimmedName.length > 50) {
      errors.push(`${fieldName} is too long (maximum 50 characters)`);
    }

    // Allow letters, spaces, hyphens, and apostrophes
    if (!/^[a-zA-Z\s\-']+$/.test(trimmedName)) {
      errors.push(
        `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate registration data
 */
export interface RegistrationData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
}

export function validateRegistration(data: RegistrationData): ValidationResult {
  const errors: string[] = [];

  // Validate email
  const emailValidation = validateEmail(data.email);
  errors.push(...emailValidation.errors);

  // Validate password
  const passwordValidation = validatePassword(data.password);
  errors.push(...passwordValidation.errors);

  // Validate password confirmation
  if (!data.confirmPassword) {
    errors.push('Password confirmation is required');
  } else if (data.password !== data.confirmPassword) {
    errors.push('Passwords do not match');
  }

  // Validate optional names
  if (data.firstName) {
    const firstNameValidation = validateName(data.firstName, 'First name');
    errors.push(...firstNameValidation.errors);
  }

  if (data.lastName) {
    const lastNameValidation = validateName(data.lastName, 'Last name');
    errors.push(...lastNameValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate login data
 */
export interface LoginData {
  email: string;
  password: string;
}

export function validateLogin(data: LoginData): ValidationResult {
  const errors: string[] = [];

  if (!data.email) {
    errors.push('Email is required');
  }

  if (!data.password) {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate password reset request
 */
export function validatePasswordResetRequest(email: string): ValidationResult {
  return validateEmail(email);
}

/**
 * Validate password reset data
 */
export interface PasswordResetData {
  token: string;
  password: string;
  confirmPassword: string;
}

export function validatePasswordReset(
  data: PasswordResetData
): ValidationResult {
  const errors: string[] = [];

  if (!data.token) {
    errors.push('Reset token is required');
  }

  // Validate new password
  const passwordValidation = validatePassword(data.password);
  errors.push(...passwordValidation.errors);

  // Validate password confirmation
  if (!data.confirmPassword) {
    errors.push('Password confirmation is required');
  } else if (data.password !== data.confirmPassword) {
    errors.push('Passwords do not match');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Sanitize name input
 */
export function sanitizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
