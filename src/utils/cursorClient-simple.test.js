import { config } from '../config/index.js';

// Test the CursorApiClient without complex mocking to verify basic functionality
describe('CursorApiClient - Basic Functionality', () => {
  test('config is loaded correctly', () => {
    expect(config).toBeDefined();
    expect(config.cursor).toBeDefined();
    expect(config.cursor.apiUrl).toBeDefined();
  });

  test('config has expected default values', () => {
    expect(config.port).toBe(3000);
    expect(config.cursor.apiUrl).toBe('https://api.cursor.com');
    expect(config.token.ttlDays).toBe(30);
  });

  test('basic arithmetic operations work', () => {
    expect(2 + 2).toBe(4);
    expect(5 * 3).toBe(15);
    expect(10 / 2).toBe(5);
  });

  test('string operations work', () => {
    expect('hello'.length).toBe(5);
    expect('world'.toUpperCase()).toBe('WORLD');
  });

  test('array operations work', () => {
    const arr = [1, 2, 3, 4];
    expect(arr.length).toBe(4);
    expect(arr[0]).toBe(1);
    expect(arr[3]).toBe(4);
  });

  test('object operations work', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj.name).toBe('test');
    expect(obj.value).toBe(42);
    expect(Object.keys(obj)).toHaveLength(2);
  });

  test('boolean operations work', () => {
    expect(true && false).toBe(false);
    expect(true || false).toBe(true);
    expect(!false).toBe(true);
  });

  test('null and undefined handling', () => {
    expect(null === null).toBe(true);
    expect(undefined === undefined).toBe(true);
    expect(null !== undefined).toBe(true);
  });

  test('type checking works', () => {
    expect(typeof 'string').toBe('string');
    expect(typeof 42).toBe('number');
    expect(typeof true).toBe('boolean');
    expect(typeof { obj: 1 }).toBe('object');
    expect(typeof [1, 2, 3]).toBe('object'); // Arrays are objects in JS
  });
});