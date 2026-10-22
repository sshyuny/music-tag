/** 앞의 `#`와 앞뒤 공백을 빼고, 연속 공백을 하나로 합친다. 남는 게 없으면 '' */
export function normalizeTagName(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ')
}

/** 같은 태그인지 비교할 때 쓰는 키. 영문 대소문자를 구분하지 않는다 */
export function tagKey(name: string): string {
  return normalizeTagName(name).toLowerCase()
}
