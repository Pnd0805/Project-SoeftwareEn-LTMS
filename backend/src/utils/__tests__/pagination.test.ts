import { describe, it, expect } from 'vitest';
import { parsePagination, buildPagination } from '../pagination.js';

describe('parsePagination — page', () => {
  it('parses a valid numeric string page', () => {
    const { newpage } = parsePagination('3', '10');
    expect(newpage).toBe(3);
  });

  it('defaults to page 1 when page is undefined', () => {
    const { newpage } = parsePagination(undefined, '10');
    expect(newpage).toBe(1);
  });

  it('defaults to page 1 when page is 0', () => {
    const { newpage } = parsePagination('0', '10');
    expect(newpage).toBe(1);
  });

  it('defaults to page 1 when page is negative', () => {
    const { newpage } = parsePagination('-5', '10');
    expect(newpage).toBe(1);
  });

  it('defaults to page 1 when page is a decimal', () => {
    const { newpage } = parsePagination('2.5', '10');
    expect(newpage).toBe(1);
  });

  it('defaults to page 1 when page is non-numeric', () => {
    const { newpage } = parsePagination('abc', '10');
    expect(newpage).toBe(1);
  });

  it('defaults to page 1 when page is an array (duplicated query param)', () => {
    const { newpage } = parsePagination(['1', '2'], '10');
    expect(newpage).toBe(1);
  });
});

describe('parsePagination — pageSize', () => {
  it('parses a valid numeric string pageSize', () => {
    const { newpageSize } = parsePagination('1', '15');
    expect(newpageSize).toBe(15);
  });

  it('defaults to pageSize 20 when pageSize is undefined', () => {
    const { newpageSize } = parsePagination('1', undefined);
    expect(newpageSize).toBe(20);
  });

  it('defaults to pageSize 20 when pageSize is 0', () => {
    const { newpageSize } = parsePagination('1', '0');
    expect(newpageSize).toBe(20);
  });

  it('defaults to pageSize 20 when pageSize is negative', () => {
    const { newpageSize } = parsePagination('1', '-10');
    expect(newpageSize).toBe(20);
  });

  it('defaults to pageSize 20 when pageSize is a decimal', () => {
    const { newpageSize } = parsePagination('1', '5.5');
    expect(newpageSize).toBe(20);
  });

  it('defaults to pageSize 20 when pageSize is non-numeric', () => {
    const { newpageSize } = parsePagination('1', 'xyz');
    expect(newpageSize).toBe(20);
  });

  it('caps pageSize at 100 when a larger valid value is given', () => {
    const { newpageSize } = parsePagination('1', '500');
    expect(newpageSize).toBe(100);
  });

  it('accepts the boundary value 100 without capping further', () => {
    const { newpageSize } = parsePagination('1', '100');
    expect(newpageSize).toBe(100);
  });

  it('accepts the boundary value 1 (smallest valid pageSize)', () => {
    const { newpageSize } = parsePagination('1', '1');
    expect(newpageSize).toBe(1);
  });
});

describe('parsePagination — offset', () => {
  it('computes offset 0 for page 1', () => {
    const { offset } = parsePagination('1', '20');
    expect(offset).toBe(0);
  });

  it('computes offset correctly for page > 1', () => {
    const { offset } = parsePagination('3', '20');
    expect(offset).toBe(40);
  });

  it('computes offset correctly with a custom pageSize', () => {
    const { offset } = parsePagination('4', '15');
    expect(offset).toBe(45);
  });

  it('computes offset 0 when both page and pageSize fall back to defaults', () => {
    const { offset } = parsePagination(undefined, undefined);
    expect(offset).toBe(0);
  });
});

describe('buildPagination', () => {
  it('returns the page, pageSize, and totalItems unchanged', () => {
    const result = buildPagination(2, 10, 45);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalItems).toBe(45);
  });

  it('rounds totalPages up when totalItems does not divide evenly', () => {
    const { totalPages } = buildPagination(1, 10, 45);
    expect(totalPages).toBe(5);
  });

  it('computes totalPages exactly when totalItems divides evenly', () => {
    const { totalPages } = buildPagination(1, 10, 50);
    expect(totalPages).toBe(5);
  });

  it('returns totalPages 0 when totalItems is 0', () => {
    const { totalPages } = buildPagination(1, 10, 0);
    expect(totalPages).toBe(0);
  });

  it('returns totalPages 1 when totalItems is less than pageSize', () => {
    const { totalPages } = buildPagination(1, 20, 7);
    expect(totalPages).toBe(1);
  });
});
