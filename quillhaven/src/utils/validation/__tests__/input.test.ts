import {
  validateProjectData,
  validateChapterData,
  validateExportRequest,
  sanitizeHtml,
  validateWordCount,
  validateFileSize,
  validateImageUpload,
} from '../input';

describe('Input Validation Utils', () => {
  describe('validateProjectData', () => {
    const validProjectData = {
      title: 'My Novel',
      description: 'A great story about adventure',
      genre: 'Fantasy',
      targetLength: 80000,
    };

    it('should validate complete project data', () => {
      const result = validateProjectData(validProjectData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should require title', () => {
      const invalidData = { ...validProjectData, title: '' };
      const result = validateProjectData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.title).toContain('Title is required');
    });

    it('should validate title length', () => {
      const longTitle = 'A'.repeat(201);
      const invalidData = { ...validProjectData, title: longTitle };
      const result = validateProjectData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.title).toContain('Title must be less than 200 characters');
    });

    it('should validate description length', () => {
      const longDescription = 'A'.repeat(1001);
      const invalidData = { ...validProjectData, description: longDescription };
      const result = validateProjectData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.description).toContain('Description must be less than 1000 characters');
    });

    it('should validate genre', () => {
      const invalidGenres = ['', 'InvalidGenre', 'A'.repeat(51)];
      
      invalidGenres.forEach((genre) => {
        const invalidData = { ...validProjectData, genre };
        const result = validateProjectData(invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.genre).toBeDefined();
      });
    });

    it('should validate target length', () => {
      const invalidLengths = [-1000, 0, 10000000];
      
      invalidLengths.forEach((targetLength) => {
        const invalidData = { ...validProjectData, targetLength };
        const result = validateProjectData(invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.targetLength).toBeDefined();
      });
    });

    it('should allow optional description', () => {
      const dataWithoutDescription = {
        title: 'My Novel',
        genre: 'Fantasy',
        targetLength: 80000,
      };
      
      const result = validateProjectData(dataWithoutDescription);
      expect(result.isValid).toBe(true);
    });

    it('should sanitize HTML in title and description', () => {
      const dataWithHtml = {
        title: '<script>alert("xss")</script>My Novel',
        description: '<img src="x" onerror="alert(1)">Great story',
        genre: 'Fantasy',
        targetLength: 80000,
      };
      
      const result = validateProjectData(dataWithHtml);
      expect(result.sanitized.title).not.toContain('<script>');
      expect(result.sanitized.description).not.toContain('<img');
    });
  });

  describe('validateChapterData', () => {
    const validChapterData = {
      title: 'Chapter 1: The Beginning',
      content: 'Once upon a time, in a land far away...',
    };

    it('should validate complete chapter data', () => {
      const result = validateChapterData(validChapterData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should require title', () => {
      const invalidData = { ...validChapterData, title: '' };
      const result = validateChapterData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.title).toContain('Title is required');
    });

    it('should validate title length', () => {
      const longTitle = 'A'.repeat(301);
      const invalidData = { ...validChapterData, title: longTitle };
      const result = validateChapterData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.title).toContain('Title must be less than 300 characters');
    });

    it('should require content', () => {
      const invalidData = { ...validChapterData, content: '' };
      const result = validateChapterData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.content).toContain('Content is required');
    });

    it('should validate content length', () => {
      const tooLongContent = 'A'.repeat(100001);
      const invalidData = { ...validChapterData, content: tooLongContent };
      const result = validateChapterData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.content).toContain('Content must be less than 100,000 characters');
    });

    it('should sanitize HTML in content', () => {
      const dataWithHtml = {
        title: 'Chapter 1',
        content: '<script>alert("xss")</script>Story content <b>bold text</b>',
      };
      
      const result = validateChapterData(dataWithHtml);
      expect(result.sanitized.content).not.toContain('<script>');
      expect(result.sanitized.content).toContain('<b>bold text</b>'); // Allow safe HTML
    });

    it('should calculate word count', () => {
      const chapterData = {
        title: 'Chapter 1',
        content: 'This is a test chapter with exactly ten words.',
      };
      
      const result = validateChapterData(chapterData);
      expect(result.wordCount).toBe(10);
    });
  });

  describe('validateExportRequest', () => {
    const validExportRequest = {
      projectId: 'project-123',
      format: 'pdf' as const,
      includeMetadata: true,
      chapterIds: ['chapter-1', 'chapter-2'],
    };

    it('should validate complete export request', () => {
      const result = validateExportRequest(validExportRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should require project ID', () => {
      const invalidData = { ...validExportRequest, projectId: '' };
      const result = validateExportRequest(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.projectId).toContain('Project ID is required');
    });

    it('should validate format', () => {
      const invalidFormats = ['', 'invalid', 'doc', 'html'];
      
      invalidFormats.forEach((format) => {
        const invalidData = { ...validExportRequest, format: format as any };
        const result = validateExportRequest(invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.format).toBeDefined();
      });
    });

    it('should validate chapter IDs array', () => {
      const invalidChapterIds = [
        [], // Empty array
        [''], // Empty string in array
        ['chapter-1', ''], // Mixed valid and invalid
      ];
      
      invalidChapterIds.forEach((chapterIds) => {
        const invalidData = { ...validExportRequest, chapterIds };
        const result = validateExportRequest(invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.chapterIds).toBeDefined();
      });
    });

    it('should allow optional chapter IDs', () => {
      const dataWithoutChapterIds = {
        projectId: 'project-123',
        format: 'pdf' as const,
        includeMetadata: true,
      };
      
      const result = validateExportRequest(dataWithoutChapterIds);
      expect(result.isValid).toBe(true);
    });

    it('should validate boolean fields', () => {
      const dataWithInvalidBoolean = {
        ...validExportRequest,
        includeMetadata: 'true' as any, // String instead of boolean
      };
      
      const result = validateExportRequest(dataWithInvalidBoolean);
      expect(result.isValid).toBe(false);
      expect(result.errors.includeMetadata).toBeDefined();
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove dangerous scripts', () => {
      const dangerousHtml = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = sanitizeHtml(dangerousHtml);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should preserve safe HTML tags', () => {
      const safeHtml = '<p>Paragraph</p><b>Bold</b><i>Italic</i><em>Emphasis</em>';
      const sanitized = sanitizeHtml(safeHtml);
      
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<b>');
      expect(sanitized).toContain('<i>');
      expect(sanitized).toContain('<em>');
    });

    it('should remove dangerous attributes', () => {
      const htmlWithDangerousAttrs = '<p onclick="alert(1)">Content</p><a href="javascript:alert(1)">Link</a>';
      const sanitized = sanitizeHtml(htmlWithDangerousAttrs);
      
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('<p>Content</p>');
    });

    it('should handle malformed HTML', () => {
      const malformedHtml = '<p>Unclosed paragraph<div>Nested <span>content</div>';
      const sanitized = sanitizeHtml(malformedHtml);
      
      expect(typeof sanitized).toBe('string');
      expect(sanitized.length).toBeGreaterThan(0);
    });

    it('should preserve line breaks', () => {
      const htmlWithBreaks = 'Line 1<br>Line 2<br/>Line 3';
      const sanitized = sanitizeHtml(htmlWithBreaks);
      
      expect(sanitized).toContain('<br>');
    });
  });

  describe('validateWordCount', () => {
    it('should count words correctly', () => {
      const testCases = [
        { text: 'Hello world', expected: 2 },
        { text: 'One', expected: 1 },
        { text: '', expected: 0 },
        { text: '   ', expected: 0 },
        { text: 'Word1 word2 word3', expected: 3 },
        { text: 'Hyphenated-word counts as one', expected: 5 },
        { text: "Don't count contractions as two", expected: 6 },
      ];

      testCases.forEach(({ text, expected }) => {
        expect(validateWordCount(text)).toBe(expected);
      });
    });

    it('should handle special characters', () => {
      const textWithSpecialChars = 'Hello, world! How are you? I\'m fine.';
      const wordCount = validateWordCount(textWithSpecialChars);
      expect(wordCount).toBe(8);
    });

    it('should handle numbers', () => {
      const textWithNumbers = 'There are 123 apples and 456 oranges.';
      const wordCount = validateWordCount(textWithNumbers);
      expect(wordCount).toBe(7);
    });

    it('should handle Unicode characters', () => {
      const unicodeText = 'Hello 世界 مرحبا мир';
      const wordCount = validateWordCount(unicodeText);
      expect(wordCount).toBe(4);
    });
  });

  describe('validateFileSize', () => {
    it('should validate file sizes within limits', () => {
      const validSizes = [1024, 1024 * 1024, 5 * 1024 * 1024]; // 1KB, 1MB, 5MB
      
      validSizes.forEach((size) => {
        expect(validateFileSize(size, 10 * 1024 * 1024)).toBe(true); // 10MB limit
      });
    });

    it('should reject files exceeding size limit', () => {
      const largeSize = 15 * 1024 * 1024; // 15MB
      const limit = 10 * 1024 * 1024; // 10MB limit
      
      expect(validateFileSize(largeSize, limit)).toBe(false);
    });

    it('should handle zero and negative sizes', () => {
      expect(validateFileSize(0, 1024)).toBe(false);
      expect(validateFileSize(-1024, 1024)).toBe(false);
    });

    it('should use default limit when not specified', () => {
      const size = 6 * 1024 * 1024; // 6MB
      expect(validateFileSize(size)).toBe(false); // Default limit is 5MB
    });
  });

  describe('validateImageUpload', () => {
    const validImageFile = {
      name: 'image.jpg',
      type: 'image/jpeg',
      size: 2 * 1024 * 1024, // 2MB
    };

    it('should validate correct image files', () => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      validTypes.forEach((type) => {
        const file = { ...validImageFile, type };
        const result = validateImageUpload(file);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject non-image files', () => {
      const invalidTypes = ['text/plain', 'application/pdf', 'video/mp4', 'audio/mp3'];
      
      invalidTypes.forEach((type) => {
        const file = { ...validImageFile, type };
        const result = validateImageUpload(file);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('File must be an image');
      });
    });

    it('should reject files that are too large', () => {
      const largeFile = {
        ...validImageFile,
        size: 15 * 1024 * 1024, // 15MB
      };
      
      const result = validateImageUpload(largeFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size must be less than 10MB');
    });

    it('should validate file extensions', () => {
      const invalidExtensions = ['image.txt', 'image.exe', 'image'];
      
      invalidExtensions.forEach((name) => {
        const file = { ...validImageFile, name };
        const result = validateImageUpload(file);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid file extension');
      });
    });

    it('should handle missing file properties', () => {
      const incompleteFile = { name: 'image.jpg' } as any;
      const result = validateImageUpload(incompleteFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('performance and security tests', () => {
    it('should handle large text validation efficiently', () => {
      const largeText = 'word '.repeat(10000); // 10,000 words
      const startTime = Date.now();
      
      const wordCount = validateWordCount(largeText);
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(wordCount).toBe(10000);
    });

    it('should sanitize HTML efficiently', () => {
      const complexHtml = '<p>'.repeat(1000) + 'Content' + '</p>'.repeat(1000);
      const startTime = Date.now();
      
      const sanitized = sanitizeHtml(complexHtml);
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500);
      expect(typeof sanitized).toBe('string');
    });

    it('should prevent ReDoS attacks in validation', () => {
      const maliciousInput = 'a'.repeat(10000) + '!';
      const startTime = Date.now();
      
      // This should not hang due to catastrophic backtracking
      validateProjectData({ title: maliciousInput, genre: 'Fantasy', targetLength: 80000 });
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle deeply nested HTML without stack overflow', () => {
      const deeplyNested = '<div>'.repeat(1000) + 'content' + '</div>'.repeat(1000);
      
      expect(() => {
        sanitizeHtml(deeplyNested);
      }).not.toThrow();
    });
  });
});