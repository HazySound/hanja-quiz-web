# 한자 퀴즈 — 웹앱(PWA) 버전

데스크탑 앱 **HanjaQuizMaker**(Python/CustomTkinter, `../HanjaQuizMakaer`)를
아이폰/아이패드에서 쓰기 위한 **웹앱(PWA)** 이식 프로젝트. 동생이 폰으로 휴대하며 사용하는 게 목적.
앱스토어 등록 X — GitHub Pages 배포 후 사파리에서 "홈 화면에 추가"로 설치, **오프라인 동작**.

## 기술 스택 (빌드도구 있음 — Node 필요)
- **Vite + React (JS, TS 아님)** — 개발서버/번들
- **Tailwind CSS v4** (`@tailwindcss/vite`, `src/index.css`의 `@import "tailwindcss"` + `@theme`)
- **React Router** — 화면 전환(`src/App.jsx`의 Routes)
- **Framer Motion** — 화면 전환·탭 애니메이션
- **vite-plugin-pwa** — manifest + service worker 자동(오프라인/홈화면). 설정은 `vite.config.js`

## 명령
- 개발: `npm run dev`  (폰에서 보려면 `npm run dev -- --host` 후 같은 WiFi에서 `http://<PC IP>:5173`)
- 빌드: `npm run build` → `dist/`
- 미리보기: `npm run preview`

## 구조
- `index.html` — iOS PWA 메타(viewport-fit, apple-mobile-web-app-*)
- `src/main.jsx` — BrowserRouter 마운트
- `src/App.jsx` — 라우팅 + 모바일퍼스트 레이아웃(폰 꽉참 / 큰화면 가운데 max-w-screen-sm)
- `src/screens/` — 화면들 (현재 Menu + Placeholder만, 기능은 이식 진행 중)
- `public/icons/` — PWA 아이콘(데스크탑 `assets/icon/icon.png`에서 생성)

## 디자인 원칙
- **모바일 퍼스트 반응형**: Tailwind 반응형 유틸(`grid-cols-1 sm:grid-cols-2` 등)로 폰↔패드 자동 적응
- 아이폰 안전영역: `env(safe-area-inset-*)` (body padding) + `viewport-fit=cover`
- 터치 타겟 최소 ~44pt, `display: standalone`으로 전체화면 앱 느낌
- 한자는 `.hanja` 클래스(iOS 시스템 CJK 폰트 사용 — 별도 웹폰트 번들 안 함)

## 이식 계획 (데스크탑 → 웹)
데스크탑의 **데이터+로직**을 가져오되 UI는 새로 작성. 참고 원본: `../HanjaQuizMakaer/`
- 데이터: `data/hanja.db`(→ JSON export 필요), `data/wordcache.json`, `grades.json`, `radicals.json`
  → 파이썬 프로젝트에 export 스크립트를 두고 이 프로젝트 `public/data/`로 내보낼 예정
- 로직(JS로 포팅): `core.py`(문제생성·채점 `grade_sa` 이분매칭·SRS·닮은꼴·두음법칙),
  `examples.py`(예시단어/뜻), `wordbook.py`(단어장 다중 컬렉션: book/wrong/custom)
- 사용자 데이터(단어장·오답·SRS 진행·설정)는 브라우저 localStorage/IndexedDB에 저장
- 주의: 통용한자/표준국어대사전 **실시간 조회**는 브라우저 CORS 제약 가능 → 우선 캐시(wordcache)만으로 동작

## 기능 목록(데스크탑 기준, 이식 대상)
랜덤/챕터/오답/헷갈림/부수 출제, 객관식·단답식·**단어** 형식, 플래시카드(+예시단어 툴팁),
목록(오답·즐겨찾기·커스텀), **단어장**(단어장/오답 단어/커스텀 목록 컬렉션, 암기·문제풀기·관리),
출제 우선순위(덜 푼 것 먼저), 급수 필터(9~1급).
