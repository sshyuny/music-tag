# music-tag

곡에 태그를 달아 두고, 태그를 조합해 다시 꺼내 듣는 개인용 웹 앱.

- **추가**: iTunes에서 곡을 찾아 저장하고, 그 자리에서 태그를 단다.
- **꺼내기**: 태그를 골라 곡을 걸러 본다. 같은 그룹 안은 OR, 다른 그룹끼리는 AND. 재생은 유튜브 검색으로 연다.
- **관리**: 태그와 그룹의 이름 변경, 그룹 지정, 삭제.

## 실행

Node 26 (`.nvmrc`).

```bash
nvm use
npm install
npm run dev      # http://localhost:5173
```

| 명령 | 내용 |
|---|---|
| `npm test` | 테스트 (Vitest) |
| `npm run lint` | 린트 (oxlint) |
| `npm run build` | 타입 검사 + 빌드 |

## 데이터

- 곡·태그·그룹은 브라우저 IndexedDB(`music-tag`)에 저장된다. 브라우저 데이터를 지우면 함께 사라진다.

## 구조

```
src/
  domain/    순수 로직 (필터, 태그 이름 정리, 검색 결과 정렬)
  ports/     외부 의존 인터페이스 (SongSearch, SongRepository, Player)
  adapters/  구현 (iTunes, Dexie/IndexedDB, 유튜브)
  ui/        React 화면
  test/      테스트 설정과 가짜 구현
```

저장소나 재생 방식을 바꿀 때는 `adapters/`에 새 구현을 추가하고 `src/main.tsx`에서 갈아 끼우면 된다.

## 문서

- 설계: [docs/superpowers/specs/2026-10-22-music-tag-design.md](docs/superpowers/specs/2026-10-22-music-tag-design.md)
- 구현 계획: [docs/superpowers/plans/2026-10-22-music-tag-mvp.md](docs/superpowers/plans/2026-10-22-music-tag-mvp.md)
