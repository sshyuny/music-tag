# music-tag

곡에 태그를 달고 태그 조합으로 다시 꺼내 듣는 개인용 웹 앱. 소개는 `README.md`.

## 현재 단계

Node.js + Fastify + SQLite 서버 DB 전환을 구현했다. 화면은 기본 사용자 한 명으로 동작한다. 로컬 API·프런트엔드 연결과 서버 재시작 후 데이터 유지를 검증했다. 기존 브라우저 데이터는 이전하지 않기로 결정했다. 2026-11-15 사용자가 전체 브라우저 수동 확인과 브라우저 재실행 후 데이터 유지를 확인했다. 홈서버 배포는 후속 작업이다. 구현·검증 상태는 `docs/superpowers/plans/2026-11-06-server-db.md`.
할 일 목록은 `docs/improvements.md`. 새로 정한 것·미룬 것은 여기에 적는다.

## 문서

- 현재 데이터 구조: `docs/design/data-model-redesign.md`
- 초기 설계(왜·무엇을): `docs/superpowers/specs/2026-10-22-music-tag-design.md`

## 실행

- Node 26 (`.nvmrc`). 셸이 다른 버전을 잡으면 `export PATH=$HOME/.nvm/versions/node/v26.12.1/bin:$PATH`
- 터미널 두 개에서 `npm run dev:server`(API, 기본 3001)와 `npm run dev`(프런트엔드)를 각각 실행한다. Vite가 `/api`를 전달한다.
- `npm run start:server`: 변경 감시 없이 API 실행. `npm test` / `npm run lint` / `npm run build`.
- DB 기본 경로는 `data/music-tag.sqlite`. `MUSIC_TAG_DB_PATH`로 변경한다. `MUSIC_TAG_API_PORT`를 바꾸면 API와 Vite에 같은 값을 지정한다.
- 마치기 전에 test·lint·build 모두 통과시킨다.

## 구조

- `domain/`: 순수 로직. 부수효과 없음.
- `ports/`: `SongSearch`, `SongRepository`, `Player` 인터페이스.
- `adapters/`: 구현(HTTP 저장소, iTunes, 유튜브, 기존 Dexie 저장소). 바꿀 땐 새 구현을 추가하고 `src/main.tsx`에서 갈아 끼운다.
- `server/`: Fastify API와 SQLite 저장소. API는 기본 사용자 `default`로 동작하고 루프백 주소에 바인딩한다.
- `ui/`: React 화면. 의존성은 `AppContext`로 받는다. 테스트는 `src/test/fakes.ts`의 가짜 구현을 쓴다.

## 규칙

- 테스트 먼저 쓰고 실패를 확인한 뒤 구현한다. 테스트 파일은 대상 파일 옆에 둔다.
- 한글 입력: 엔터 처리 시 `isComposing`과 `keyCode === 229`를 둘 다 무시한다.
- iTunes는 `country=US` 고정, 분당 약 20회 제한. `previewUrl`은 쓰지 않는다.
- SQLite 스키마를 바꿀 땐 `PRAGMA user_version`을 올리고 기존 데이터를 보존하는 마이그레이션을 검증한다. 현재 버전은 1이다. DB·저널 파일은 Git에 넣지 않는다.
- 기존 IndexedDB는 현재 앱에서 사용하거나 삭제하지 않는다. 이전 Dexie 버전의 `music-tag` 삭제 합의는 당시 전환에 한정된다. SQLite와 `music-tag-v2`를 포함한 기존 데이터는 별도 합의 없이 지우지 않는다.
- 개인 저장소(`github.com/sshyuny/music-tag`)라 `main`에 커밋·push 가능. force-push는 안 한다.
