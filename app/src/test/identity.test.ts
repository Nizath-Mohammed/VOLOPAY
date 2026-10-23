import { describe, it, expect } from 'vitest';
import { getRecordKey, parseRecordKey, parseUrlRecordHash } from '../engine/identity';

describe('Canonical Identity and URL Hash Parser', () => {
  it('T-ID-01: getRecordKey produces deterministic JSON tuple string', () => {
    expect(getRecordKey('call', 'C-101')).toBe('["call","C-101"]');
    expect(getRecordKey('meeting', 'M-07')).toBe('["meeting","M-07"]');
  });

  it('T-ID-02 & T-ID-03: parseRecordKey correctly parses valid call and meeting keys', () => {
    expect(parseRecordKey('["call","C-101"]')).toEqual(['call', 'C-101']);
    expect(parseRecordKey('["meeting","M-07"]')).toEqual(['meeting', 'M-07']);
  });

  it('T-ID-04: parseRecordKey preserves reserved characters in source_id verbatim', () => {
    const complexId = 'meeting:2026/08/21?rev=2&state=active#hash/01';
    const key = getRecordKey('meeting', complexId);
    expect(parseRecordKey(key)).toEqual(['meeting', complexId]);
  });

  it('T-ID-05: parseRecordKey throws on malformed JSON', () => {
    expect(() => parseRecordKey('{not-json}')).toThrow(/malformed JSON/i);
    expect(() => parseRecordKey('call:C-101')).toThrow(/malformed JSON/i);
  });

  it('T-ID-06 & T-ID-07: parseRecordKey throws on non-2-element arrays', () => {
    expect(() => parseRecordKey('["call"]')).toThrow(/expected 2-element tuple/i);
    expect(() => parseRecordKey('["call","C-01","extra"]')).toThrow(/expected 2-element tuple/i);
    expect(() => parseRecordKey('[]')).toThrow(/expected 2-element tuple/i);
  });

  it('T-ID-08: parseRecordKey throws on invalid source_type', () => {
    expect(() => parseRecordKey('["sms","101"]')).toThrow(/source_type must be 'call' \| 'meeting'/i);
    expect(() => parseRecordKey('["email","101"]')).toThrow(/source_type must be 'call' \| 'meeting'/i);
    expect(() => parseRecordKey('[123,"C-01"]')).toThrow(/source_type must be 'call' \| 'meeting'/i);
  });

  it('T-ID-09 & T-ID-10: parseRecordKey does not silently coerce numbers, null, or booleans', () => {
    expect(() => parseRecordKey('["call", 12345]')).toThrow(/source_id must be a non-empty string/i);
    expect(() => parseRecordKey('["call", null]')).toThrow(/source_id must be a non-empty string/i);
    expect(() => parseRecordKey('["meeting", true]')).toThrow(/source_id must be a non-empty string/i);
  });

  it('T-ID-11: parseRecordKey throws on empty or whitespace source_id', () => {
    expect(() => parseRecordKey('["call", ""]')).toThrow(/source_id must be a non-empty string/i);
    expect(() => parseRecordKey('["call", "   "]')).toThrow(/source_id must be a non-empty string/i);
  });

  it('T-ID-12: parseUrlRecordHash extracts and parses valid URL-encoded hash param', () => {
    const canonicalKey = getRecordKey('call', 'C-101');
    const encoded = encodeURIComponent(canonicalKey);
    expect(parseUrlRecordHash(encoded)).toEqual(['call', 'C-101']);
  });

  it('T-ID-13 & T-ID-14: parseUrlRecordHash returns null without throwing for malformed or invalid inputs', () => {
    // Undecodable percent encoding
    expect(parseUrlRecordHash('%E0%A4%A')).toBeNull();
    // Non-JSON garbage
    expect(parseUrlRecordHash('garbage-value')).toBeNull();
    // Invalid source_type
    expect(parseUrlRecordHash(encodeURIComponent('["chat","id-123"]'))).toBeNull();
    // Empty or non-string
    expect(parseUrlRecordHash('')).toBeNull();
    expect(parseUrlRecordHash(null as unknown as string)).toBeNull();
  });
});
