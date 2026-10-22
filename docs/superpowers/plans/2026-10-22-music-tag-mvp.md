# music-tag MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 곡을 iTunes로 검색해 태그를 달고, 태그를 겹쳐 골라 곡을 다시 꺼내는 PC 브라우저용 로컬 웹앱.

**Architecture:** 순수 로직(태그 이름 정리, 필터 규칙, 검색 결과 정렬)은 `src/domain`에 두고 단위 테스트로 고정한다. 바뀔 수 있는 외부 의존 3개(`SongSearch`, `SongRepository`, `Player`)는 `src/ports`의 인터페이스로 두고, `src/adapters`에 첫 구현(iTunes, Dexie, 유튜브 링크)을 둔다. UI는 React 화면 3개(추가 / 꺼내기 / 관리)이고, 리포지토리를 직접 부르고 변경 후 다시 읽는다.

**Tech Stack:** Node 26.12.1, TypeScript, React, Vite (create-vite `react-ts` 템플릿 버전 그대로), Dexie 4.4, Vitest 5, jsdom 30, @testing-library/react 16, @testing-library/user-event 14, @testing-library/jest-dom, fake-indexeddb 6.

**Spec:** `docs/superpowers/specs/2026-10-22-music-tag-design.md`

## Global Constraints

- Node는 **v26.12.1** (nvm 기본값, 프로젝트 `.nvmrc`). 라이브러리는 최신 버전을 쓴다.
- iTunes 검색 URL은 `country=US&media=music&entity=song`로 고정한다. `country=KR`은 결과가 0건이다.
- 문자열 정리: iTunes에서 받은 곡명과 아티스트명에서 `U+200B`~`U+200F`, `U+202A`~`U+202E`, `U+2060`, `U+FEFF`를 지우고 앞뒤 공백을 자른다.
- 미리듣기(`previewUrl`)는 저장하지도 쓰지도 않는다. 앨범아트(`artworkUrl100`)만 표시한다.
- 필터 규칙: **같은 그룹 안은 OR, 다른 그룹끼리는 AND**. 그룹 없는 태그는 각각 혼자 하나의 그룹으로 취급한다.
- 태그 이름: 앞의 `#`(여러 개면 전부)와 앞뒤 공백을 빼고, 연속 공백은 하나로 합친다. 같은지 비교할 때는 영문 소문자로 바꿔서 비교한다.
- 한글 조합 중(`event.nativeEvent.isComposing` 또는 `keyCode === 229`)에 누른 엔터는 무시한다.
- PC 브라우저 전용. 모바일 레이아웃은 만들지 않는다.
- 화면 문구는 한국어다.
- git: 원격 저장소가 없으므로 `main`에는 커밋하지 않는다. 작업 브랜치는 `feat/mvp`이다.

## Review Focus

1. **검색 응답이 순서를 바꿔 도착하는 경우**: "밤"의 응답이 "밤편지"의 응답보다 늦게 와도, 화면에는 마지막 입력의 결과가 보여야 한다. → Task 9 `ignores stale search responses`
2. **iTunes 호출 실패** (분당 제한, 네트워크 오류): 화면이 깨지지 않아야 한다. "내 곡" 결과는 그대로 보이고, iTunes 구역에는 오류 문구가 떠야 한다. → Task 5 `throws SearchError on non-ok response`, Task 9 `shows error message when search fails`
3. **같은 태그가 다른 표기로 들어오는 경우**: `#가을`, ` 가을 `, `JAZZ`/`jazz`. 태그가 하나만 있어야 하고, 같은 곡에 두 번 달려도 하나로 남아야 한다. → Task 6 `createTag returns existing tag for same key`, `addTagToSong is idempotent`
4. **한글 조합 중 엔터**: "가을"을 치다가 조합이 덜 끝난 상태에서 엔터를 눌러도 "가으" 같은 태그가 만들어지지 않아야 한다. → Task 8 `ignores Enter while composing`
5. **꺼내기 화면에서 고른 태그를 관리 화면에서 지운 경우**: 선택에서 조용히 빠지고, 화면이 깨지지 않아야 한다. → Task 3 `ignores selected ids that no longer exist`

---

## File Structure

```
src/
  domain/
    types.ts            Song, Tag, TagGroup, SearchResult 타입
    tagName.ts          normalizeTagName, tagKey
    filter.ts           filterSongs, dimmedTagIds, browsableTags
    searchText.ts       cleanText, isAltVersion, rankItunesResults, matchSavedSongs
  ports/
    SongSearch.ts       interface SongSearch, class SearchError
    SongRepository.ts   interface SongRepository, class DuplicateTagNameError
    Player.ts           interface Player
  adapters/
    itunesSearch.ts     ItunesSongSearch
    dexieRepository.ts  DexieSongRepository
    youtubePlayer.ts    YoutubePlayer, youtubeSearchUrl
  ui/
    AppContext.tsx      의존성 주입 + 라이브러리 상태 (useApp)
    App.tsx             탭 3개 전환
    TagInput.tsx        태그 조회+생성 입력창
    AddSongScreen.tsx   화면 1
    BrowseScreen.tsx    화면 2
    ManageScreen.tsx    화면 3
  main.tsx              실제 어댑터를 주입해 렌더링
  test/setup.ts         jest-dom, fake-indexeddb/auto
```

테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다.

---

### Task 1: 프로젝트 뼈대 + 테스트 환경 + git

**Files:**
- Create: create-vite `react-ts` 템플릿 전체 (`~/my-projects/music-tag`에, 기존 `docs/`는 유지)
- Create: `src/test/setup.ts`, `src/smoke.test.ts`, `.nvmrc`
- Modify: `vite.config.ts`, `package.json`, `.gitignore`

**Interfaces:**
- Produces: `npm test`(= `vitest run`), `npm run dev`, `npm run build`

- [ ] **Step 1: 템플릿 생성**

```bash
cd ~/my-projects && npm create vite@latest music-tag-tmp -- --template react-ts
rsync -a music-tag-tmp/ music-tag/ && rm -rf music-tag-tmp
cd music-tag && npm install
npm install dexie@^4.4.6
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom fake-indexeddb
echo "26.12.1" > .nvmrc
```

템플릿의 데모 코드(`App.tsx` 카운터, `App.css`, `assets/react.svg`)는 지운다.

- [ ] **Step 2: 테스트 설정**

`vite.config.ts`에 `test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'], globals: true }`를 추가한다. 맨 위에 `/// <reference types="vitest/config" />`를 둔다. `src/test/setup.ts`는 `@testing-library/jest-dom/vitest`와 `fake-indexeddb/auto`를 import한다. `package.json` scripts에 `"test": "vitest run"`을 추가한다.

- [ ] **Step 3: 실패하는 스모크 테스트**

```ts
// src/smoke.test.ts
it('has indexedDB in test env', () => {
  expect(globalThis.indexedDB).toBeDefined()
  expect(1 + 1).toBe(3)
})
```

Run: `npm test` → Expected: FAIL (`expected 2 to be 3`)

- [ ] **Step 4: `3`을 `2`로 고치고 통과 확인**

Run: `npm test` → Expected: PASS. 이어서 `npm run build` → 에러 없음.

- [ ] **Step 5: git 초기화와 커밋** (`main` 금지)

```bash
git init -b feat/mvp
printf '\n.superpowers/\n' >> .gitignore
git add -A && git commit -m "chore: Vite React TS 뼈대와 Vitest 환경 구성"
```

---

### Task 2: 도메인 타입 + 태그 이름 정리

**Files:**
- Create: `src/domain/types.ts`, `src/domain/tagName.ts`
- Test: `src/domain/tagName.test.ts`

**Interfaces:**
- Produces:

```ts
// types.ts
export interface Song {
  trackId: number          // iTunes trackId, 곡 구분 기준
  title: string            // 표시 제목 (사용자가 수정 가능)
  originalTitle: string    // iTunes 원래 제목
  artistName: string
  albumName: string | null
  artworkUrl: string | null
  releaseDate: string | null
  tagIds: string[]
  addedAt: number          // epoch ms
}
export interface Tag { id: string; name: string; groupId: string | null; lastUsedAt: number | null }
export interface TagGroup { id: string; name: string }
export type SearchResult = Omit<Song, 'title' | 'tagIds' | 'addedAt'>
```

```ts
// tagName.ts
export function normalizeTagName(raw: string): string  // 비어 있으면 ''
export function tagKey(name: string): string            // normalizeTagName 후 toLowerCase
```

- [ ] **Step 1: 실패하는 테스트**

```ts
describe('normalizeTagName', () => {
  it('strips leading hashes and trims', () => {
    expect(normalizeTagName('  #가을 ')).toBe('가을')
    expect(normalizeTagName('##새벽')).toBe('새벽')
  })
  it('collapses inner whitespace', () => expect(normalizeTagName('주말   아침')).toBe('주말 아침'))
  it('returns empty for blank or hash-only', () => {
    expect(normalizeTagName('   ')).toBe('')
    expect(normalizeTagName('#')).toBe('')
  })
  it('keeps case', () => expect(normalizeTagName('EDM')).toBe('EDM'))
})
describe('tagKey', () => {
  it('is case-insensitive', () => expect(tagKey('#Jazz')).toBe(tagKey('jazz')))
})
```

- [ ] **Step 2:** `npx vitest run src/domain/tagName.test.ts` → FAIL (모듈 없음)
- [ ] **Step 3:** `types.ts`, `tagName.ts` 구현
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** `git commit -m "feat: 도메인 타입과 태그 이름 정리 규칙"`

---

### Task 3: 필터 규칙

**Files:**
- Create: `src/domain/filter.ts`
- Test: `src/domain/filter.test.ts`

**Interfaces:**
- Consumes: `Song`, `Tag` (Task 2)
- Produces:

```ts
export function filterSongs(songs: Song[], tags: Tag[], selectedTagIds: ReadonlySet<string>): Song[]
export function dimmedTagIds(songs: Song[], tags: Tag[], selectedTagIds: ReadonlySet<string>): Set<string>
export function browsableTags(songs: Song[], tags: Tag[]): Tag[]   // 곡이 1개 이상인 태그만
export function tagSongCounts(songs: Song[]): Map<string, number>
```

규칙:
- 그룹 키 = `tag.groupId ?? 'solo:' + tag.id`
- `filterSongs`: `tags`에 없는 선택 id는 무시한다. 유효한 선택이 없으면 전체 곡을 `addedAt` 내림차순으로 돌려준다. 있으면, 선택된 그룹 키마다 그 그룹에서 고른 태그 중 하나라도 곡에 있어야 남긴다. 결과도 `addedAt` 내림차순이다.
- `dimmedTagIds`: 선택 안 된 태그 t 중 **t의 그룹 키가 이미 선택에 있으면 흐리게 하지 않는다**. 그 외에는 `filterSongs(선택 ∪ {t})`가 비면 흐리게 한다. 선택이 없으면 빈 Set을 돌려준다.

- [ ] **Step 1: 실패하는 테스트**

픽스처: 그룹 `season`에 태그 `summer`, `autumn`. 그룹 `genre`에 태그 `jazz`. 그룹 없는 태그 `dawn`, `rain`.
곡: s1 `[autumn, dawn]`, s2 `[autumn]`, s3 `[summer, jazz]`, s4 `[rain]`. `addedAt`은 s1=1, s2=2, s3=3, s4=4.

```ts
it('returns all songs newest first when nothing selected', () =>
  expect(ids(filterSongs(songs, tags, new Set()))).toEqual([4, 3, 2, 1]))
it('ORs within the same group', () =>
  expect(ids(filterSongs(songs, tags, new Set(['summer', 'autumn'])))).toEqual([3, 2, 1]))
it('ANDs across groups', () =>
  expect(ids(filterSongs(songs, tags, new Set(['summer', 'autumn', 'jazz'])))).toEqual([3]))
it('treats ungrouped tags as their own group', () =>
  expect(ids(filterSongs(songs, tags, new Set(['summer', 'autumn', 'dawn'])))).toEqual([1]))
it('ignores selected ids that no longer exist', () =>
  expect(ids(filterSongs(songs, tags, new Set(['deleted-id', 'jazz'])))).toEqual([3]))
it('does not dim tags in an already-selected group', () =>
  expect(dimmedTagIds(songs, tags, new Set(['summer'])).has('autumn')).toBe(false))
it('dims cross-group tags that would yield zero songs', () => {
  const dimmed = dimmedTagIds(songs, tags, new Set(['summer']))
  expect(dimmed.has('dawn')).toBe(true)
  expect(dimmed.has('jazz')).toBe(false)
})
it('browsableTags hides tags with zero songs', () => {
  const extra = [...tags, { id: 'empty', name: '빈태그', groupId: null, lastUsedAt: null }]
  expect(browsableTags(songs, extra).map(t => t.id)).not.toContain('empty')
})
```

(`ids = (s: Song[]) => s.map(x => x.trackId)`)

- [ ] **Step 2:** `npx vitest run src/domain/filter.test.ts` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** `git commit -m "feat: 태그 필터 규칙 (그룹 내 OR, 그룹 간 AND)"`

---

### Task 4: 검색 텍스트 처리

**Files:**
- Create: `src/domain/searchText.ts`
- Test: `src/domain/searchText.test.ts`

**Interfaces:**
- Consumes: `Song`, `SearchResult` (Task 2)
- Produces:

```ts
export function cleanText(s: string): string
export function isAltVersion(title: string): boolean     // /instrumental|karaoke|piano|\binst\b/i
export function rankItunesResults(results: SearchResult[], savedTrackIds: ReadonlySet<number>): SearchResult[]
export function matchSavedSongs(songs: Song[], query: string): Song[]
```

- `rankItunesResults`: 저장된 trackId는 뺀다. 원곡 버전을 먼저, 다른 버전을 뒤에 두고, 각 구간 안에서는 원래 순서를 유지한다.
- `matchSavedSongs`: 쿼리와 대상 모두 소문자로 바꾸고 공백을 지운 뒤, `title`, `originalTitle`, `artistName` 중 하나라도 쿼리를 포함하면 남긴다. 빈 쿼리면 `[]`를 돌려준다.

- [ ] **Step 1: 실패하는 테스트**

```ts
it('cleanText removes invisible marks', () => expect(cleanText('‎Good Night Good Dream ')).toBe('Good Night Good Dream'))
it('isAltVersion detects versions', () => {
  expect(isAltVersion('Through the Night [Piano]')).toBe(true)
  expect(isAltVersion('I Knew I Love (Instrumental)')).toBe(true)
  expect(isAltVersion('가끔 미치도록 … (Karaoke Verison)')).toBe(true)
  expect(isAltVersion('Through the Night')).toBe(false)
})
it('rank drops saved and pushes alt versions down, stable', () => {
  // 입력 순서: 1 Instrumental, 2 원곡, 3 원곡(저장됨), 4 원곡
  expect(rankItunesResults(results, new Set([3])).map(r => r.trackId)).toEqual([2, 4, 1])
})
it('matchSavedSongs matches display title, original title, artist ignoring case/space', () => {
  // song: title '밤편지', originalTitle 'Through the Night', artistName 'IU'
  expect(matchSavedSongs([song], '밤 편지')).toHaveLength(1)
  expect(matchSavedSongs([song], 'through')).toHaveLength(1)
  expect(matchSavedSongs([song], 'iu')).toHaveLength(1)
  expect(matchSavedSongs([song], '')).toHaveLength(0)
})
```

- [ ] **Step 2:** `npx vitest run src/domain/searchText.test.ts` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** `git commit -m "feat: 검색 결과 정리와 정렬 규칙"`

---

### Task 5: SongSearch 포트 + iTunes 어댑터

**Files:**
- Create: `src/ports/SongSearch.ts`, `src/adapters/itunesSearch.ts`
- Test: `src/adapters/itunesSearch.test.ts`

**Interfaces:**
- Consumes: `SearchResult` (Task 2), `cleanText` (Task 4)
- Produces:

```ts
export interface SongSearch { search(term: string, signal?: AbortSignal): Promise<SearchResult[]> }
export class SearchError extends Error {}
export class ItunesSongSearch implements SongSearch {
  constructor(fetchFn: typeof fetch = fetch.bind(globalThis))
}
```

- URL: `https://itunes.apple.com/search?term=${encodeURIComponent(term.trim())}&country=US&media=music&entity=song&limit=25`
- 필드 매핑: `trackId`, `trackName`→`originalTitle`(cleanText), `artistName`(cleanText), `collectionName`→`albumName`(없으면 null), `artworkUrl100`→`artworkUrl`, `releaseDate`. `kind !== 'song'`인 결과는 버린다.
- `term.trim()`이 비어 있으면 fetch를 부르지 않고 `[]`를 돌려준다. `!res.ok`이거나 fetch가 실패하면 `SearchError`를 던진다. 단, `AbortError`는 그대로 다시 던진다.

- [ ] **Step 1: 실패하는 테스트** (가짜 `fetchFn` 주입)

```ts
it('builds US song search URL', ...)            // 호출된 URL에 'country=US', 'entity=song', 인코딩된 '밤편지' 포함
it('maps and cleans fields', ...)                // '‎Good Night' → originalTitle 'Good Night', previewUrl 키 없음
it('skips fetch for blank term', ...)            // fetchFn 호출 0회, 결과 []
it('throws SearchError on non-ok response', ...) // status 403 → rejects.toBeInstanceOf(SearchError)
```

- [ ] **Step 2:** `npx vitest run src/adapters/itunesSearch.test.ts` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** `git commit -m "feat: iTunes 곡 검색 어댑터"`

---

### Task 6: SongRepository 포트 + Dexie 어댑터

**Files:**
- Create: `src/ports/SongRepository.ts`, `src/adapters/dexieRepository.ts`
- Test: `src/adapters/dexieRepository.test.ts`

**Interfaces:**
- Consumes: 타입 (Task 2), `normalizeTagName`, `tagKey` (Task 2)
- Produces:

```ts
export class DuplicateTagNameError extends Error {}
export class InvalidNameError extends Error {}
export interface SongRepository {
  listSongs(): Promise<Song[]>
  saveSong(result: SearchResult): Promise<Song>              // 이미 있으면 기존 곡을 그대로 돌려준다
  updateSongTitle(trackId: number, title: string): Promise<void>  // 빈 제목이면 originalTitle로 되돌린다
  deleteSong(trackId: number): Promise<void>
  addTagToSong(trackId: number, tagId: string): Promise<void>     // 중복 없이 추가하고, tag.lastUsedAt = now()
  removeTagFromSong(trackId: number, tagId: string): Promise<void>
  listTags(): Promise<Tag[]>
  createTag(rawName: string): Promise<Tag>   // 같은 tagKey가 있으면 기존 태그를 돌려준다. 이름이 비면 InvalidNameError
  renameTag(tagId: string, rawName: string): Promise<void>  // 다른 태그와 tagKey가 겹치면 DuplicateTagNameError
  deleteTag(tagId: string): Promise<void>    // 모든 곡의 tagIds에서도 뺀다
  setTagGroup(tagId: string, groupId: string | null): Promise<void>
  listGroups(): Promise<TagGroup[]>
  createGroup(name: string): Promise<TagGroup>
  renameGroup(groupId: string, name: string): Promise<void>
  deleteGroup(groupId: string): Promise<void>  // 소속 태그의 groupId를 null로 바꾼다
}
export class DexieSongRepository implements SongRepository {
  constructor(dbName = 'music-tag', now: () => number = Date.now, newId: () => string = () => crypto.randomUUID())
}
```

- Dexie 스키마 v1: `songs: '&trackId, *tagIds, addedAt'`, `tags: '&id, groupId'`, `groups: '&id'`
- 여러 테이블에 걸친 변경(`deleteTag`, `deleteGroup`)은 `db.transaction('rw', ...)`으로 묶는다.

- [ ] **Step 1: 실패하는 테스트** (테스트마다 `new DexieSongRepository('test-' + crypto.randomUUID(), () => 1000)`)

```ts
it('saveSong stores with title = originalTitle and returns existing on resave', ...)
it('updateSongTitle sets display title, blank reverts to original', ...)
it('createTag returns existing tag for same key', ...)   // createTag('#Jazz') 후 createTag('jazz') → 같은 id, listTags 길이 1
it('createTag rejects blank name', ...)                  // createTag('#') → InvalidNameError
it('addTagToSong is idempotent and touches lastUsedAt', ...) // 두 번 추가 → tagIds 길이 1, lastUsedAt 1000
it('renameTag rejects duplicate key', ...)               // '가을','여름' 있을 때 rename(여름,'#가을') → DuplicateTagNameError
it('renameTag allows case change of itself', ...)        // rename(jazz,'JAZZ') → 성공
it('deleteTag removes it from songs', ...)
it('deleteGroup ungroups its tags', ...)
it('deleteSong removes song', ...)
it('persists across instances with same dbName', ...)    // 새 인스턴스로 listSongs → 데이터 있음
```

- [ ] **Step 2:** `npx vitest run src/adapters/dexieRepository.test.ts` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** `git commit -m "feat: IndexedDB 저장소 (Dexie)"`

---

### Task 7: Player + 앱 껍데기 + 의존성 주입

**Files:**
- Create: `src/ports/Player.ts`, `src/adapters/youtubePlayer.ts`, `src/ui/AppContext.tsx`, `src/ui/App.tsx`
- Modify: `src/main.tsx`, `index.html` (`<title>music-tag</title>`, `lang="ko"`)
- Test: `src/adapters/youtubePlayer.test.ts`, `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: 포트 3개
- Produces:

```ts
export interface Player { play(song: Pick<Song, 'artistName' | 'originalTitle'>): void }
export function youtubeSearchUrl(song: Pick<Song, 'artistName' | 'originalTitle'>): string
  // https://www.youtube.com/results?search_query=<encodeURIComponent(artistName + ' ' + originalTitle)>
export class YoutubePlayer implements Player {}   // window.open(url, '_blank', 'noopener')

// AppContext.tsx
export interface AppDeps { repo: SongRepository; search: SongSearch; player: Player }
export function AppProvider(props: { deps: AppDeps; children: ReactNode }): JSX.Element
export function useApp(): AppDeps & {
  songs: Song[]; tags: Tag[]; groups: TagGroup[]
  refresh(): Promise<void>     // 저장소에서 다시 읽는다. 화면은 변경 후 반드시 호출
}
// App.tsx: 탭 버튼 '추가' | '꺼내기' | '관리'. 기본은 '추가'. 화면 컴포넌트는 Task 9~11에서 채우고, 그 전까지는 제목만 둔다.
```

- [ ] **Step 1: 실패하는 테스트**

```ts
it('youtubeSearchUrl encodes artist and original title', () =>
  expect(youtubeSearchUrl({ artistName: 'IU', originalTitle: 'Through the Night' }))
    .toBe('https://www.youtube.com/results?search_query=IU%20Through%20the%20Night'))
it('App switches tabs', async () => { /* '꺼내기' 클릭 → heading '꺼내기' 보임 */ })
```

- [ ] **Step 2:** `npx vitest run src/adapters/youtubePlayer.test.ts src/ui/App.test.tsx` → FAIL
- [ ] **Step 3:** 구현. `main.tsx`는 `new DexieSongRepository()`, `new ItunesSongSearch()`, `new YoutubePlayer()`를 주입한다.
- [ ] **Step 4:** → PASS. `npm run dev`로 띄워서 탭 3개가 보이는지 확인
- [ ] **Step 5:** `git commit -m "feat: 앱 껍데기와 유튜브 재생 연결"`

---

### Task 8: TagInput (태그 조회 + 생성)

**Files:**
- Create: `src/ui/TagInput.tsx`
- Test: `src/ui/TagInput.test.tsx`

**Interfaces:**
- Consumes: `Tag`, `tagKey`, `normalizeTagName`
- Produces:

```ts
export function TagInput(props: {
  tags: Tag[]                       // 전체 태그
  excludeIds: ReadonlySet<string>   // 이미 곡에 달린 태그
  songCounts: Map<string, number>   // 자동완성에 곡 수 표시
  onPick(tagId: string): void       // 기존 태그 선택
  onCreate(name: string): void      // 새 태그 (정리된 이름 전달)
}): JSX.Element
```

동작:
- 입력값의 `tagKey`를 포함하는 태그를 자동완성에 띄운다. 앞부분이 일치하는 태그가 먼저 오고, 그다음은 이름순이다. `excludeIds`에 있는 태그는 뺀다.
- 일치하는 태그가 없거나 입력과 정확히 같은 태그가 없으면, 목록 끝에 `＋ "<이름>" 새 태그로 만들기` 항목을 둔다.
- 첫 항목이 기본으로 강조된다. ↑↓로 강조를 옮기고, 엔터나 클릭으로 실행한다. 실행하면 입력창을 비운다. Esc를 누르면 목록이 닫힌다.
- 입력과 정확히 같은 태그가 있으면 엔터는 그 태그를 고른다 (새로 만들지 않음).
- 조합 중인 엔터는 무시한다 (Global Constraints).

- [ ] **Step 1: 실패하는 테스트** (`userEvent`)

```ts
it('suggests matching tags with counts', ...)          // '가' 입력 → '#가을 · 12곡', '#가을새벽 · 3곡'
it('excludes tags already on the song', ...)
it('Enter picks highlighted existing tag', ...)        // '가' + Enter → onPick('autumn'), 입력 비워짐
it('ArrowDown then Enter picks second', ...)
it('Enter on exact match picks, not creates', ...)     // '#가을' + Enter → onPick, onCreate 0회
it('Enter on new name creates normalized', ...)        // '  #비오는날 ' + Enter → onCreate('비오는날')
it('ignores Enter while composing', ...)               // fireEvent.keyDown(input, { key: 'Enter', isComposing: true }) → onPick/onCreate 0회
it('ignores Enter on blank', ...)
```

- [ ] **Step 2:** `npx vitest run src/ui/TagInput.test.tsx` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** `git commit -m "feat: 태그 조회·생성 입력창"`

---

### Task 9: 화면 1 — 곡 추가 → 태그 달기

**Files:**
- Create: `src/ui/AddSongScreen.tsx`
- Modify: `src/ui/App.tsx` ('추가' 탭에 연결)
- Test: `src/ui/AddSongScreen.test.tsx`

**Interfaces:**
- Consumes: `useApp`, `TagInput`, `matchSavedSongs`, `rankItunesResults`, `tagSongCounts`, `SearchError`

동작:
- 검색창 하나. "내 곡" 결과(`matchSavedSongs`)는 입력 즉시 보인다. iTunes 결과는 입력이 **400ms** 멈춘 뒤에 호출한다. 새 호출을 보내기 전에 이전 호출은 `AbortController`로 취소하고, 늦게 도착한 이전 응답은 버린다.
- 두 구역 제목: `내 곡`, `iTunes 검색 결과`. iTunes 실패 시 그 구역에 `iTunes 검색에 실패했어. 잠시 뒤 다시 시도해줘.`를 띄운다.
- 결과 행: 앨범아트(있으면), 제목, `아티스트 · 앨범 · 연도`. 내 곡 행에는 달린 태그도 함께 보인다.
- 곡을 고르면: iTunes 결과는 `repo.saveSong` 후 선택한다. 선택된 곡 패널에는 다음이 있다.
  - 표시 제목 입력란: blur나 엔터에서 `updateSongTitle`. 아래에 `원제 <originalTitle>`를 보여준다.
  - 달린 태그 칩: `#이름 ✕`. ✕를 누르면 `removeTagFromSong`.
  - `최근 쓴 태그` 칩: `lastUsedAt` 내림차순 최대 **8개**. 이미 달린 태그는 뺀다. 누르면 `addTagToSong`.
  - `TagInput`: `onCreate`는 `createTag` 후 `addTagToSong`.
  - `곡 삭제` 버튼: `deleteSong` 후 선택을 해제한다.
- 모든 변경 후 `refresh()`.

- [ ] **Step 1: 실패하는 테스트** (fake-indexeddb의 `DexieSongRepository` + 가짜 `SongSearch`, `vi.useFakeTimers({ shouldAdvanceTime: true })`)

```ts
it('shows saved songs first and hides them from iTunes section', ...)
it('debounces iTunes search', ...)                      // 빠르게 입력 → search 호출 1회
it('ignores stale search responses', ...)               // '밤' 응답을 '밤편지' 응답보다 늦게 resolve → '밤편지' 결과만 보임
it('shows error message when search fails', ...)        // search reject(SearchError) → 오류 문구, 내 곡 구역 유지
it('selecting iTunes result saves it and shows tag panel', ...)
it('creating a tag via input attaches it', ...)         // '가을' + Enter → 칩 '#가을 ✕'
it('recent tag chip attaches in one click', ...)
it('edits display title', ...)                          // '밤편지'로 수정 → 원제 'Through the Night' 표시, 저장소 반영
```

- [ ] **Step 2:** `npx vitest run src/ui/AddSongScreen.test.tsx` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** `git commit -m "feat: 곡 추가와 태그 달기 화면"`

---

### Task 10: 화면 2 — 태그로 꺼내기

**Files:**
- Create: `src/ui/BrowseScreen.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/ui/BrowseScreen.test.tsx`

**Interfaces:**
- Consumes: `useApp`, `filterSongs`, `dimmedTagIds`, `browsableTags`, `tagSongCounts`

동작:
- 태그 목록(`browsableTags`)을 그룹별로 묶어 보여준다. 그룹은 이름순이고, 맨 끝에 `그룹 없음`이 온다. 칩은 `#이름 <곡 수>` 형태다. 칩은 토글이고, 선택되면 `aria-pressed="true"`, 흐린 칩은 `data-dimmed="true"`를 단다. 흐린 칩도 누를 수 있다.
- 선택 상태는 화면 안 state(`Set<string>`)로 둔다. 결과 제목은 `<N>곡`이다. 선택 칩을 ✕로 해제할 수 있고, `선택 해제` 버튼도 둔다.
- 결과 행: 제목, 아티스트, 달린 태그, `▶` 버튼(`player.play(song)`).
- `전체 재생` 버튼은 `disabled`이고 `title="재생할 곳을 정한 뒤 지원"`을 단다.
- 곡이 없으면 `아직 태그 단 곡이 없어. '추가' 탭에서 시작해줘.`를 띄운다.

- [ ] **Step 1: 실패하는 테스트** (Task 3과 같은 픽스처를 저장소에 넣고 렌더링)

```ts
it('groups tags and shows counts', ...)
it('OR within group, AND across groups', ...)  // summer+autumn → 3곡, +dawn → 1곡
it('marks dimmed tags', ...)                   // summer 선택 → dawn 칩 data-dimmed="true"
it('play button calls player', ...)            // 가짜 player.play 호출 인자 확인
it('play-all is disabled', ...)
```

- [ ] **Step 2:** `npx vitest run src/ui/BrowseScreen.test.tsx` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** `git commit -m "feat: 태그로 꺼내기 화면"`

---

### Task 11: 화면 3 — 태그·그룹 관리

**Files:**
- Create: `src/ui/ManageScreen.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/ui/ManageScreen.test.tsx`

**Interfaces:**
- Consumes: `useApp`, `tagSongCounts`, `DuplicateTagNameError`, `InvalidNameError`

동작:
- 그룹 구역: `새 그룹` 입력 + 엔터로 만든다. 각 그룹에 이름 수정(인라인 입력, 엔터/blur 저장)과 `삭제` 버튼이 있다. 삭제 확인은 `window.confirm`을 쓰지 않는다. 버튼을 한 번 더 누르게 한다 (`삭제` → `정말 삭제`).
- 태그 구역: 전체 태그를 이름순으로 보여준다 (곡이 0개인 태그 포함). 행마다 다음이 있다.
  - 이름 수정
  - 그룹 선택 `<select>` (`그룹 없음` + 그룹들)
  - 곡 수
  - `삭제` (두 번 누르기)
- `새 태그` 입력 + 엔터로 태그만 만들 수 있다.
- 이름이 중복이면 그 행에 `이미 있는 태그 이름이야.`를 띄우고 원래 이름으로 되돌린다. 빈 이름이면 원래 이름으로 되돌린다.

- [ ] **Step 1: 실패하는 테스트**

```ts
it('creates group and assigns tag to it', ...)
it('renames tag', ...)
it('shows error on duplicate rename and reverts', ...)
it('deleting group keeps tags as ungrouped', ...)
it('delete requires second click', ...)
it('lists zero-song tags', ...)
```

- [ ] **Step 2:** `npx vitest run src/ui/ManageScreen.test.tsx` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** `git commit -m "feat: 태그·그룹 관리 화면"`

---

### Task 12: 실제 브라우저로 완료 시나리오 검증

**Files:** 없음 (버그가 나오면 해당 파일을 고치고, 고치기 전에 재현 테스트를 추가한다)

- [ ] **Step 1:** `npm test && npm run build` → 전부 PASS, 빌드 에러 없음
- [ ] **Step 2:** `npm run dev` 후 브라우저(claude-in-chrome)에서 spec 7절 시나리오 1~7을 실제 iTunes API로 수행한다. 각 단계의 스크린샷을 남긴다.
- [ ] **Step 3:** 6번째 단계(태그 이름 변경) 뒤에 새로고침 → 데이터가 그대로 있는지 확인 (시나리오 7)
- [ ] **Step 4:** 발견한 문제를 수정하고, 수정할 때마다 커밋한다. 결과는 사용자에게 시나리오별 통과/실패로 보고한다.
