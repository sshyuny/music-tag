it('has indexedDB in test env', () => {
  expect(globalThis.indexedDB).toBeDefined()
  expect(1 + 1).toBe(2)
})
