import { test, expect } from '@playwright/test';
import {
  parseResearchData,
  parseSnapshotLayersData,
  parseSnapshotFilesData,
  parseChangeLogValue,
} from '../lib/validation';

/**
 * Validation Tests
 *
 * Tests runtime validation of Json fields from Prisma database.
 * These tests ensure data integrity and graceful error handling.
 */

test.describe('Research Data Validation', () => {
  test('should parse valid research data', () => {
    const validData = {
      query: 'Test query',
      depth: 'moderate',
      summary: 'Test summary',
      fullReport: 'Full report text',
      sources: [{ url: 'https://example.com', title: 'Test Source' }],
      sourcesAnalyzed: 1,
      metadata: {
        maxSources: 10,
        mode: 'local',
      },
    };

    const result = parseResearchData(validData);
    expect(result).not.toBeNull();
    expect(result?.query).toBe('Test query');
    expect(result?.depth).toBe('moderate');
    expect(result?.sources).toHaveLength(1);
  });

  test('should return null for invalid depth enum', () => {
    const invalidData = {
      query: 'Test',
      depth: 'invalid_depth',
      summary: 'Test',
      fullReport: 'Test',
      sources: [],
      sourcesAnalyzed: 0,
      metadata: {},
    };

    const result = parseResearchData(invalidData);
    expect(result).toBeNull();
  });

  test('should return null for missing required fields', () => {
    const invalidData = {
      query: 'Test',
      // missing depth, summary, etc.
    };

    const result = parseResearchData(invalidData);
    expect(result).toBeNull();
  });

  test('should handle noRecommendationsReason field', () => {
    const validData = {
      query: 'Test query',
      depth: 'quick',
      summary: 'Test summary',
      fullReport: 'Full report',
      sources: [],
      sourcesAnalyzed: 0,
      metadata: {},
      noRecommendationsReason: 'Research found existing corpus is comprehensive',
    };

    const result = parseResearchData(validData);
    expect(result).not.toBeNull();
    expect(result?.noRecommendationsReason).toBe('Research found existing corpus is comprehensive');
  });

  test('should handle empty sources array', () => {
    const validData = {
      query: 'Test query',
      depth: 'deep',
      summary: 'Test summary',
      fullReport: 'Full report',
      sources: [],
      sourcesAnalyzed: 0,
      metadata: {},
    };

    const result = parseResearchData(validData);
    expect(result).not.toBeNull();
    expect(result?.sources).toEqual([]);
    expect(result?.sourcesAnalyzed).toBe(0);
  });
});

test.describe('Snapshot Layers Data Validation', () => {
  test('should parse valid snapshot layers data', () => {
    const validData = [
      {
        id: 'layer1',
        title: 'Test Layer',
        content: 'Test content',
        priority: 1,
        isActive: true,
        projectId: 'project1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const result = parseSnapshotLayersData(validData);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result?.[0]?.title).toBe('Test Layer');
  });

  test('should return null for invalid layer structure', () => {
    const invalidData = [
      {
        id: 'layer1',
        title: 'Test Layer',
        // missing required fields
      },
    ];

    const result = parseSnapshotLayersData(invalidData);
    expect(result).toBeNull();
  });

  test('should handle empty array', () => {
    const validData: Array<{
      id: string;
      title: string;
      content: string;
      priority: number;
      isActive: boolean;
      projectId: string;
      createdAt: string;
      updatedAt: string;
    }> = [];

    const result = parseSnapshotLayersData(validData);
    expect(result).not.toBeNull();
    expect(result).toEqual([]);
  });
});

test.describe('Snapshot Files Data Validation', () => {
  test('should parse valid snapshot files data', () => {
    const validData = [
      {
        id: 'file1',
        title: 'Test File',
        description: 'Test description',
        content: 'Test content',
        category: 'Test',
        isActive: true,
        projectId: 'project1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const result = parseSnapshotFilesData(validData);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result?.[0]?.title).toBe('Test File');
    expect(result?.[0]?.description).toBe('Test description');
  });

  test('should handle null description and category', () => {
    const validData = [
      {
        id: 'file1',
        title: 'Test File',
        description: null,
        content: 'Test content',
        category: null,
        isActive: true,
        projectId: 'project1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const result = parseSnapshotFilesData(validData);
    expect(result).not.toBeNull();
    expect(result?.[0]?.description).toBeNull();
    expect(result?.[0]?.category).toBeNull();
  });

  test('should return null for invalid file structure', () => {
    const invalidData = [
      {
        id: 'file1',
        // missing required fields
      },
    ];

    const result = parseSnapshotFilesData(invalidData);
    expect(result).toBeNull();
  });
});

test.describe('Change Log Value Validation', () => {
  test('should parse valid change log value', () => {
    const validData = {
      id: 'item1',
      title: 'Test Item',
      content: 'Test content',
      isActive: true,
    };

    const result = parseChangeLogValue(validData);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Test Item');
    expect(result?.content).toBe('Test content');
  });

  test('should return null for null input', () => {
    const result = parseChangeLogValue(null);
    expect(result).toBeNull();
  });

  test('should return null for undefined input', () => {
    const result = parseChangeLogValue(undefined);
    expect(result).toBeNull();
  });

  test('should handle optional fields', () => {
    const validData = {
      title: 'Test Item',
      content: 'Test content',
      description: 'Optional description',
      category: 'Optional category',
      priority: 5,
    };

    const result = parseChangeLogValue(validData);
    expect(result).not.toBeNull();
    expect(result?.description).toBe('Optional description');
    expect(result?.category).toBe('Optional category');
    expect(result?.priority).toBe(5);
  });

  test('should allow passthrough of additional fields', () => {
    const validData = {
      title: 'Test Item',
      content: 'Test content',
      customField: 'custom value', // Not in schema but passthrough enabled
    };

    const result = parseChangeLogValue(validData);
    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>)?.customField).toBe('custom value');
  });

  test('should return null for missing required fields', () => {
    const invalidData = {
      id: 'item1',
      // missing title and content
    };

    const result = parseChangeLogValue(invalidData);
    expect(result).toBeNull();
  });
});

test.describe('Edge Cases', () => {
  test('should handle corrupt JSON-like data', () => {
    const corruptData = {
      query: 123, // wrong type
      depth: 'moderate',
      summary: ['array', 'instead', 'of', 'string'], // wrong type
      fullReport: null, // wrong type
      sources: 'not an array', // wrong type
      sourcesAnalyzed: 'not a number', // wrong type
      metadata: [],  // wrong type
    };

    const result = parseResearchData(corruptData);
    expect(result).toBeNull();
  });

  test('should handle deeply nested invalid data', () => {
    const invalidData = {
      query: 'Test',
      depth: 'quick',
      summary: 'Test',
      fullReport: 'Test',
      sources: [
        {
          url: 'not a valid url', // invalid URL
          title: 123, // wrong type
        },
      ],
      sourcesAnalyzed: 1,
      metadata: {},
    };

    const result = parseResearchData(invalidData);
    expect(result).toBeNull();
  });

  test('should validate all depth enum values', () => {
    const validDepths = ['quick', 'moderate', 'deep'];

    for (const depth of validDepths) {
      const data = {
        query: 'Test',
        depth,
        summary: 'Test',
        fullReport: 'Test',
        sources: [],
        sourcesAnalyzed: 0,
        metadata: {},
      };

      const result = parseResearchData(data);
      expect(result).not.toBeNull();
      expect(result?.depth).toBe(depth);
    }
  });
});
