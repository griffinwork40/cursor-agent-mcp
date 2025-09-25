// Basic smoke tests to verify Jest is wired up correctly

describe('smoke', () => {
  test('truthiness', () => {
    expect(true).toBe(true);
  });

  test('math works', () => {
    expect(2 + 2).toBe(4);
  });
});


