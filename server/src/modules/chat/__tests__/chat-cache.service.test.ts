/**
 * ChatCacheService Unit Tests
 * Tests for cache service with indexed search functionality
 * 
 * Uses jest.unstable_mockModule() for ESM compatibility
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll } from '@jest/globals';

// Import mock data first (no mocking needed)
import {
  mockVehicles,
  mockDrivers,
  mockOperators,
  mockRoutes,
  mockBadges,
  mockDispatchRecords,
  mockSchedules,
  mockServices,
  mockShifts,
  mockInvoices,
  mockViolations,
  mockServiceCharges,
  createMockSnapshot,
  plateVariations,
} from './mocks/chat-mock-data.js';

// Define typed mock function at module scope BEFORE mock registration
const mockOnce = jest.fn<(path: string) => Promise<{ val: () => any; exists: () => boolean }>>();

// Register mock BEFORE importing the service (ESM requirement)
jest.unstable_mockModule('../../../config/database.js', () => ({
  firebaseDb: {
    ref: (path: string) => ({
      once: () => mockOnce(path),
    }),
  },
}));

// Dynamic import AFTER mock registration
const { chatCacheService } = await import('../services/chat-cache.service.js');

// Helper to setup mock for all collections
const setupCollectionMocks = () => {
  mockOnce.mockImplementation((path: string) => {
    const collectionMap: Record<string, any[]> = {
      'datasheet/Xe': mockVehicles,
      'datasheet/PHUHIEUXE': mockBadges,
      'datasheet/DONVIVANTAI': mockOperators,
      'datasheet/DANHMUCTUYENCODINH': mockRoutes,
      'drivers': mockDrivers,
      'dispatch_records': mockDispatchRecords,
      'schedules': mockSchedules,
      'services': mockServices,
      'shifts': mockShifts,
      'invoices': mockInvoices,
      'violations': mockViolations,
      'service_charges': mockServiceCharges,
    };
    const data = collectionMap[path] || [];
    return Promise.resolve(createMockSnapshot(data));
  });
};

describe('ChatCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupCollectionMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('preWarm', () => {
    it('should load all collections into cache', async () => {
      await chatCacheService.preWarm();
      expect(chatCacheService.isReady()).toBe(true);
    });

    it('should call Firebase for each collection', async () => {
      await chatCacheService.preWarm();
      expect(mockOnce).toHaveBeenCalled();
      // Should be called for 12 collections
      expect(mockOnce.mock.calls.length).toBeGreaterThanOrEqual(12);
    });

    it('should handle empty collections gracefully', async () => {
      mockOnce.mockImplementation(() => Promise.resolve({ val: () => null, exists: () => false }));
      await chatCacheService.preWarm();
      expect(chatCacheService.isReady()).toBe(true);
    });

    it('should handle Firebase errors gracefully', async () => {
      mockOnce.mockImplementation(() => Promise.reject(new Error('Firebase error')));
      await chatCacheService.preWarm();
      expect(chatCacheService.isReady()).toBe(true);
    });
  });

  describe('searchVehicleByPlate', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should find vehicle by exact plate number', () => {
      const results = chatCacheService.searchVehicleByPlate('98H07480');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].BienSo || results[0].plate_number).toBe('98H07480');
    });

    it('should find vehicle with different plate formats', () => {
      const variations = plateVariations['98H07480'];
      variations.forEach((variation: string) => {
        const results = chatCacheService.searchVehicleByPlate(variation);
        expect(results.length).toBeGreaterThan(0);
      });
    });

    it('should find vehicle by partial plate number', () => {
      const results = chatCacheService.searchVehicleByPlate('07480');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const upperResults = chatCacheService.searchVehicleByPlate('98H07480');
      const lowerResults = chatCacheService.searchVehicleByPlate('98h07480');
      expect(upperResults.length).toBe(lowerResults.length);
    });

    it('should return empty array for non-existent plate', () => {
      const results = chatCacheService.searchVehicleByPlate('ZZZZZZZ');
      expect(results).toEqual([]);
    });

    it('should handle special characters in plate number', () => {
      const results = chatCacheService.searchVehicleByPlate('98H-07480');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle empty string input', () => {
      const results = chatCacheService.searchVehicleByPlate('');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should deduplicate results', () => {
      const results = chatCacheService.searchVehicleByPlate('98H07480');
      const ids = results.map((r: any) => r.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('searchDriverByName', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should find driver by full name', () => {
      const results = chatCacheService.searchDriverByName('Nguyen Van An');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find driver by partial name', () => {
      const results = chatCacheService.searchDriverByName('Nguyen');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const upperResults = chatCacheService.searchDriverByName('NGUYEN');
      const lowerResults = chatCacheService.searchDriverByName('nguyen');
      expect(upperResults.length).toBe(lowerResults.length);
    });

    it('should handle Vietnamese text without diacritics', () => {
      const results = chatCacheService.searchDriverByName('nguyen van an');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent driver', () => {
      const results = chatCacheService.searchDriverByName('Nonexistent Driver Name');
      expect(results).toEqual([]);
    });

    it('should handle empty string input', () => {
      const results = chatCacheService.searchDriverByName('');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('searchOperatorByName', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should find operator by name', () => {
      const results = chatCacheService.searchOperatorByName('Phuong Trang');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find operator by partial name', () => {
      const results = chatCacheService.searchOperatorByName('Mai Linh');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const results = chatCacheService.searchOperatorByName('phuong trang');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle Vietnamese text normalization', () => {
      const results = chatCacheService.searchOperatorByName('thanh buoi');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent operator', () => {
      const results = chatCacheService.searchOperatorByName('Nonexistent Company');
      expect(results).toEqual([]);
    });
  });

  describe('searchRouteByCode', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should find route by code', () => {
      const results = chatCacheService.searchRouteByCode('TPHCM-DALAT-001');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find route by departure station', () => {
      const results = chatCacheService.searchRouteByCode('TP.HCM');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find route by arrival station', () => {
      const results = chatCacheService.searchRouteByCode('Da Lat');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const results = chatCacheService.searchRouteByCode('tphcm');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent route', () => {
      const results = chatCacheService.searchRouteByCode('NONEXISTENT');
      expect(results).toEqual([]);
    });
  });

  describe('searchBadgeByNumber', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should find badge by number', () => {
      const results = chatCacheService.searchBadgeByNumber('PH-12345');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find badge by plate number', () => {
      const results = chatCacheService.searchBadgeByNumber('98H07480');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle partial badge number', () => {
      const results = chatCacheService.searchBadgeByNumber('12345');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent badge', () => {
      const results = chatCacheService.searchBadgeByNumber('NONEXISTENT');
      expect(results).toEqual([]);
    });
  });

  describe('getDispatchStats', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should return stats for today when no date provided', () => {
      const stats = chatCacheService.getDispatchStats();
      expect(stats).toHaveProperty('date');
      expect(stats).toHaveProperty('entered');
      expect(stats).toHaveProperty('departed');
      expect(stats).toHaveProperty('total');
    });

    it('should return stats for specific date', () => {
      const stats = chatCacheService.getDispatchStats('2025-12-25');
      expect(stats.date).toBe('2025-12-25');
      expect(typeof stats.entered).toBe('number');
      expect(typeof stats.departed).toBe('number');
    });

    it('should return zero stats for date with no records', () => {
      const stats = chatCacheService.getDispatchStats('2020-01-01');
      expect(stats.entered).toBe(0);
      expect(stats.departed).toBe(0);
    });
  });

  describe('getSystemStats', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should return stats for all collections', () => {
      const stats = chatCacheService.getSystemStats();
      expect(stats).toHaveProperty('vehicles');
      expect(stats).toHaveProperty('badges');
      expect(stats).toHaveProperty('operators');
      expect(stats).toHaveProperty('routes');
      expect(stats).toHaveProperty('drivers');
      expect(stats).toHaveProperty('dispatch_records');
      expect(stats).toHaveProperty('schedules');
      expect(stats).toHaveProperty('services');
      expect(stats).toHaveProperty('shifts');
      expect(stats).toHaveProperty('invoices');
      expect(stats).toHaveProperty('violations');
      expect(stats).toHaveProperty('service_charges');
      expect(stats).toHaveProperty('lastRefresh');
    });

    it('should return correct counts', () => {
      const stats = chatCacheService.getSystemStats();
      expect(stats.vehicles).toBe(mockVehicles.length);
      expect(stats.drivers).toBe(mockDrivers.length);
      expect(stats.operators).toBe(mockOperators.length);
    });
  });

  describe('searchSchedules', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should return schedules without search term', () => {
      const results = chatCacheService.searchSchedules('');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return schedules for "today"', () => {
      const results = chatCacheService.searchSchedules('today');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should find schedule by code', () => {
      const results = chatCacheService.searchSchedules('SCH-001');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('searchServices', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should return services without search term', () => {
      const results = chatCacheService.searchServices('');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should find service by name', () => {
      const results = chatCacheService.searchServices('Rua xe');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find service by code', () => {
      const results = chatCacheService.searchServices('SV-RX');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getShiftInfo', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should return shifts without date', () => {
      const results = chatCacheService.getShiftInfo();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return shifts for specific date', () => {
      const results = chatCacheService.getShiftInfo('2025-12-25');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getInvoices', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should return invoices without date', () => {
      const results = chatCacheService.getInvoices();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return invoices for specific date', () => {
      const results = chatCacheService.getInvoices('2025-12-25');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should respect limit parameter', () => {
      const results = chatCacheService.getInvoices(undefined, 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getViolations', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should return all violations without plate', () => {
      const results = chatCacheService.getViolations();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return violations for specific plate', () => {
      const results = chatCacheService.getViolations('98H07480');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for plate with no violations', () => {
      const results = chatCacheService.getViolations('NONEXISTENT');
      expect(results).toEqual([]);
    });
  });

  describe('getServiceCharges', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should return all charges without service filter', () => {
      const results = chatCacheService.getServiceCharges();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return charges for specific service', () => {
      const results = chatCacheService.getServiceCharges('Phi vao ben');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('fuzzySearch', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should detect and search plate numbers', () => {
      const results = chatCacheService.fuzzySearch('xe 98H07480');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search across multiple collections', () => {
      const results = chatCacheService.fuzzySearch('Phuong Trang');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should limit results to 10', () => {
      const results = chatCacheService.fuzzySearch('a');
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty query', () => {
      const results = chatCacheService.fuzzySearch('');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('isReady', () => {
    it('should return boolean', () => {
      expect(typeof chatCacheService.isReady()).toBe('boolean');
    });

    it('should return true after preWarm', async () => {
      await chatCacheService.preWarm();
      expect(chatCacheService.isReady()).toBe(true);
    });
  });

  describe('Text Normalization', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should normalize plate numbers correctly', () => {
      const variations = ['98H07480', '98H-07480', '98H 07480', '98h07480'];
      variations.forEach((v) => {
        const results = chatCacheService.searchVehicleByPlate(v);
        expect(results.length).toBeGreaterThan(0);
      });
    });

    it('should handle mixed case in operator names', () => {
      const variations = ['Phuong Trang', 'PHUONG TRANG', 'phuong trang'];
      variations.forEach((v) => {
        const results = chatCacheService.searchOperatorByName(v);
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await chatCacheService.preWarm();
    });

    it('should handle very long search terms', () => {
      const longQuery = 'a'.repeat(1000);
      const results = chatCacheService.fuzzySearch(longQuery);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()[]{}';
      const results = chatCacheService.fuzzySearch(specialChars);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle numeric-only queries', () => {
      const results = chatCacheService.fuzzySearch('12345');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle whitespace-only queries', () => {
      const results = chatCacheService.fuzzySearch('   ');
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
