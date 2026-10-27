# music-tag

곡에 태그를 달고 태그 조합으로 다시 꺼내 듣는 개인용 웹 앱. 소개는 `README.md`.

## 현재 단계

MVP 완료. 사용자가 직접 써보는 중. 다음 후보는 백업(JSON 내보내기/가져오기).
할 일 목록은 `docs/improvements.md`. 새로 정한 것·미룬 것은 여기에 적는다.

## 문서

- 설계(왜·무엇을): `docs/superpowers/specs/2026-10-22-music-tag-design.md`
- 서비스 목적 원문: 옵시디언 vault `~/Documents/00.sohyun/md-files/2610-음악-태그-기록/`

## 실행

- Node 26 (`.nvmrc`). 셸이 다른 버전을 잡으면 `export PATH=$HOME/.nvm/versions/node/v26.12.1/bin:$PATH`
- `npm run dev` / `npm test` / `npm run lint` / `npm run build`
- 마치기 전에 test·lint·build 모두 통과시킨다.

## 구조

- `domain/`: 순수 로직. 부수효과 없음.
- `ports/`: `SongSearch`, `SongRepository`, `Player` 인터페이스.
- `adapters/`: 구현(iTunes, Dexie, 유튜브). 바꿀 땐 새 구현을 추가하고 `src/main.tsx`에서 갈아 끼운다.
- `ui/`: React 화면. 의존성은 `AppContext`로 받는다. 테스트는 `src/test/fakes.ts`의 가짜 구현을 쓴다.

## 규칙

- 테스트 먼저 쓰고 실패를 확인한 뒤 구현한다. 테스트 파일은 대상 파일 옆에 둔다.
- 한글 입력: 엔터 처리 시 `isComposing`과 `keyCode === 229`를 둘 다 무시한다.
- iTunes는 `country=US` 고정, 분당 약 20회 제한. `previewUrl`은 쓰지 않는다.
- 저장소 스키마(Dexie)를 바꿀 땐 버전을 올리고 기존 데이터가 남는지 확인한다.
- 개인 저장소(`github.com/sshyuny/music-tag`)라 `main`에 커밋·push 가능. force-push는 안 한다.
