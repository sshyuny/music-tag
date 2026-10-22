import { normalizeTagName, tagKey } from './tagName'

describe('normalizeTagName', () => {
  it('strips leading hashes and trims', () => {
    expect(normalizeTagName('  #가을 ')).toBe('가을')
    expect(normalizeTagName('##새벽')).toBe('새벽')
  })

  it('collapses inner whitespace', () => {
    expect(normalizeTagName('주말   아침')).toBe('주말 아침')
  })

  it('returns empty for blank or hash-only', () => {
    expect(normalizeTagName('   ')).toBe('')
    expect(normalizeTagName('#')).toBe('')
  })

  it('keeps case', () => {
    expect(normalizeTagName('EDM')).toBe('EDM')
  })
})

describe('tagKey', () => {
  it('is case-insensitive', () => {
    expect(tagKey('#Jazz')).toBe(tagKey('jazz'))
  })
})
