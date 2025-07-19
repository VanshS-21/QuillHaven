import { calculatePagination, createPaginationQuery } from '../pagination';

describe('Pagination Utils', () => {
  describe('calculatePagination', () => {
    it('should calculate pagination for first page', () => {
      const result = calculatePagination(1, 10, 100);

      expect(result).toEqual({
        page: 1,
        limit: 10,
        offset: 0,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
        total: 100,
      });
    });

    it('should calculate pagination for middle page', () => {
      const result = calculatePagination(5, 10, 100);

      expect(result).toEqual({
        page: 5,
        limit: 10,
        offset: 40,
        totalPages: 10,
        hasNext: true,
        hasPrev: true,
        total: 100,
      });
    });

    it('should calculate pagination for last page', () => {
      const result = calculatePagination(10, 10, 100);

      expect(result).toEqual({
        page: 10,
        limit: 10,
        offset: 90,
        totalPages: 10,
        hasNext: false,
        hasPrev: true,
        total: 100,
      });
    });

    it('should handle partial last page', () => {
      const result = calculatePagination(3, 10, 25);

      expect(result).toEqual({
        page: 3,
        limit: 10,
        offset: 20,
        totalPages: 3,
        hasNext: false,
        hasPrev: true,
        total: 25,
      });
    });

    it('should handle zero total items', () => {
      const result = calculatePagination(1, 10, 0);

      expect(result).toEqual({
        page: 1,
        limit: 10,
        offset: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
        total: 0,
      });
    });

    it('should handle page beyond total pages', () => {
      const result = calculatePagination(15, 10, 100);

      expect(result).toEqual({
        page: 15,
        limit: 10,
        offset: 140,
        totalPages: 10,
        hasNext: false,
        hasPrev: true,
        total: 100,
      });
    });

    it('should handle negative page numbers', () => {
      const result = calculatePagination(-1, 10, 100);

      expect(result).toEqual({
        page: 1, // Should default to page 1
        limit: 10,
        offset: 0,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
        total: 100,
      });
    });

    it('should handle zero or negative limit', () => {
      const result = calculatePagination(1, 0, 100);

      expect(result).toEqual({
        page: 1,
        limit: 10, // Should default to 10
        offset: 0,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
        total: 100,
      });
    });

    it('should handle very large limit', () => {
      const result = calculatePagination(1, 1000, 100);

      expect(result).toEqual({
        page: 1,
        limit: 100, // Should cap at 100
        offset: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
        total: 100,
      });
    });
  });

  describe('createPaginationQuery', () => {
    it('should create basic pagination query', () => {
      const result = createPaginationQuery(2, 15);

      expect(result).toEqual({
        skip: 15,
        take: 15,
      });
    });

    it('should handle first page', () => {
      const result = createPaginationQuery(1, 10);

      expect(result).toEqual({
        skip: 0,
        take: 10,
      });
    });

    it('should handle large page numbers', () => {
      const result = createPaginationQuery(100, 25);

      expect(result).toEqual({
        skip: 2475, // (100 - 1) * 25
        take: 25,
      });
    });

    it('should handle edge cases with defaults', () => {
      const result = createPaginationQuery(0, 0);

      expect(result).toEqual({
        skip: 0, // Page 0 becomes page 1, so (1-1)*10 = 0
        take: 10, // Default limit
      });
    });

    it('should cap limit at maximum', () => {
      const result = createPaginationQuery(1, 500);

      expect(result).toEqual({
        skip: 0,
        take: 100, // Capped at maximum
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle floating point page numbers', () => {
      const result = calculatePagination(2.7, 10, 100);

      expect(result.page).toBe(2); // Should floor to integer
      expect(result.offset).toBe(10);
    });

    it('should handle floating point limits', () => {
      const result = calculatePagination(1, 10.5, 100);

      expect(result.limit).toBe(10); // Should floor to integer
    });

    it('should handle very large numbers', () => {
      const result = calculatePagination(1, 10, Number.MAX_SAFE_INTEGER);

      expect(result.totalPages).toBeGreaterThan(0);
      expect(result.total).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle string inputs by converting to numbers', () => {
      const result = calculatePagination('3' as any, '20' as any, '150' as any);

      expect(result).toEqual({
        page: 3,
        limit: 20,
        offset: 40,
        totalPages: 8, // Math.ceil(150/20)
        hasNext: true,
        hasPrev: true,
        total: 150,
      });
    });

    it('should handle NaN inputs gracefully', () => {
      const result = calculatePagination(NaN, NaN, NaN);

      expect(result).toEqual({
        page: 1, // Default
        limit: 10, // Default
        offset: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
        total: 0,
      });
    });
  });

  describe('performance with large datasets', () => {
    it('should handle large pagination calculations efficiently', () => {
      const startTime = Date.now();

      // Test with very large numbers
      const result = calculatePagination(50000, 100, 10000000);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(10); // Should complete in under 10ms
      expect(result.page).toBe(50000);
      expect(result.offset).toBe(4999900);
      expect(result.totalPages).toBe(100000);
    });

    it('should handle multiple rapid calculations', () => {
      const startTime = Date.now();

      // Perform 1000 calculations
      for (let i = 1; i <= 1000; i++) {
        calculatePagination(i, 25, 50000);
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('boundary conditions', () => {
    it('should handle single item pagination', () => {
      const result = calculatePagination(1, 1, 1);

      expect(result).toEqual({
        page: 1,
        limit: 1,
        offset: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
        total: 1,
      });
    });

    it('should handle exact page boundary', () => {
      const result = calculatePagination(5, 20, 100);

      expect(result).toEqual({
        page: 5,
        limit: 20,
        offset: 80,
        totalPages: 5,
        hasNext: false,
        hasPrev: true,
        total: 100,
      });
    });

    it('should handle one item over page boundary', () => {
      const result = calculatePagination(6, 20, 101);

      expect(result).toEqual({
        page: 6,
        limit: 20,
        offset: 100,
        totalPages: 6,
        hasNext: false,
        hasPrev: true,
        total: 101,
      });
    });
  });
});
