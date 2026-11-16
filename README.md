# music-tag

곡에 태그를 달아 두고, 태그를 조합해 다시 꺼내 듣는 개인용 웹 앱.

- **추가**: iTunes에서 곡을 찾아 저장하고, 그 자리에서 태그를 단다.
- **꺼내기**: 태그를 골라 곡을 걸러 본다. 같은 그룹 안은 OR, 다른 그룹끼리는 AND. 목록에서 곡을 선택해 태그를 붙이거나 뗄 수 있다. 재생은 유튜브 검색으로 연다.
- **관리**: 태그와 그룹의 이름 변경, 그룹 지정, 삭제.

## 실행

Node 26 (`.nvmrc`). 먼저 의존성을 설치한다.

```bash
nvm use
npm install
```

터미널 두 개에서 API 서버와 프런트엔드를 각각 실행한다.

```bash
# 터미널 1: API 서버 (http://127.0.0.1:3001)
npm run dev:server
```

```bash
# 터미널 2: 프런트엔드 (기본 http://localhost:5173)
npm run dev
```

프런트엔드의 `/api` 요청은 Vite가 API 서버로 전달한다. 현재 범위는 로컬 개발 환경이며 홈서버 배포·로그인·외부 접속은 후속 작업이다.

| 명령 | 내용 |
|---|---|
| `npm run dev:server` | API 서버 실행, 서버 코드 변경 시 재시작 |
| `npm run start:server` | API 서버 실행 (변경 감시 없음) |
| `npm run dev` | 프런트엔드 개발 서버 |
| `npm test` | 프런트엔드·서버 테스트 (Vitest) |
| `npm run lint` | 린트 (oxlint) |
| `npm run build` | 프런트엔드·서버 타입 검사 + 프런트엔드 빌드 |

API 서버는 `127.0.0.1`에 바인딩한다. 아래 환경변수로 설정을 바꿀 수 있다. `.env` 파일 자동 로드는 설정하지 않았다.

| 환경변수 | 기본값 | 적용 대상 |
|---|---|---|
| `MUSIC_TAG_DB_PATH` | `data/music-tag.sqlite` | API 서버. 상대 경로는 실행 디렉터리 기준 |
| `MUSIC_TAG_API_PORT` | `3001` | API 서버와 Vite 프록시. 변경하면 두 터미널에 같은 값을 지정 |

예를 들어 DB 위치와 API 포트를 바꾸려면 다음처럼 실행한다.

```bash
# 터미널 1
MUSIC_TAG_DB_PATH=./data/local.sqlite MUSIC_TAG_API_PORT=3002 npm run dev:server
# 터미널 2
MUSIC_TAG_API_PORT=3002 npm run dev
```

## 데이터

- 데이터는 Node.js + Fastify API를 통해 서버의 SQLite 파일에 저장된다. 기본 위치는 `data/music-tag.sqlite`이며, 상위 디렉터리와 DB는 첫 실행 시 생성된다. 별도 DB 서버 설치는 필요 없다.
- `users`, `songs`, `tags`, `groups`, `songTags` 테이블을 사용한다. 곡은 공통이며 태그·그룹·곡–태그 연결은 사용자별로 관리한다.
- API는 기본 사용자 `default`로 동작한다. 로그인·사용자 전환 기능은 아직 없다.
- 곡 제목 수정은 공통으로 반영된다. 곡 삭제는 앱에서 제공하지 않는다.
- 브라우저 데이터를 지워도 서버 DB는 유지된다. 서버를 재시작해도 같은 DB 경로를 사용하면 데이터가 남는다. 다른 클라이언트의 변경은 재조회·새로고침으로 확인하며 실시간 갱신은 제공하지 않는다.
- SQLite 스키마 버전은 `PRAGMA user_version = 1`이다. 알 수 없는 상위 버전은 열지 않는다. DB 파일과 SQLite 저널 파일은 Git 추적에서 제외한다.
- 기존 브라우저의 `music-tag`, `music-tag-v2` IndexedDB는 현재 앱 시작 과정에서 읽거나 삭제하지 않는다. SQLite로 자동 이관하지 않으며, 2026-11-15 결정에 따라 기존 데이터는 이전하지 않는다. 정기 백업·복원은 아직 구현하지 않았다.

## 구조

```
src/
  domain/    순수 로직 (필터, 태그 이름 정리, 검색 결과 정렬)
  ports/     외부 의존 인터페이스 (SongSearch, SongRepository, Player)
  adapters/  구현 (HTTP 저장소, iTunes, 유튜브, 기존 Dexie 저장소)
  ui/        React 화면
  test/      테스트 설정과 가짜 구현
server/
  main.ts              API 실행, DB 경로·포트 설정과 종료 처리
  app.ts               Fastify API, 요청 검증과 오류 응답
  sqliteRepository.ts  SQLite 스키마 초기화와 저장소 구현
```

앱은 `HttpSongRepository`를 사용한다. 기존 Dexie 구현은 테스트용 저장소로도 사용하며 앱 시작 경로에서는 호출하지 않는다.

저장소나 재생 방식을 바꿀 때는 `adapters/`에 새 구현을 추가하고 `src/main.tsx`에서 갈아 끼우면 된다.

## 문서

개발 순서와 단계별 상세 문서는 [개발 흐름](docs/00.개발흐름.md)에서 찾아본다.

- 이후 할 일과 보류한 사항: [이후 할 일](docs/90.이후-할-일.md)
- LLM 작업 지침: [AGENTS.md](AGENTS.md)
