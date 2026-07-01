// 전역 설정(localStorage). 지금은 급수 필터(전 모드 공통). 추후 테마/글꼴 등도 여기에.
const KEY = 'hq.prefs.v1'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
function save(p) {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function getGrade() {
  return load().grade ?? null // null = 전체
}
export function getOnly() {
  return load().only ?? false // 배정한자만 여부
}
export function setGradePref(grade, only) {
  save({ ...load(), grade, only })
}

// 빠른 학습 설정(범위·형식·방향)을 기억 → 풀이 갔다 와도/다시 들어와도 그대로.
const QKEY = 'hq.quickcfg.v1'
export function getQuickCfg() {
  try {
    return JSON.parse(localStorage.getItem(QKEY)) || {}
  } catch {
    return {}
  }
}
export function setQuickCfg(cfg) {
  localStorage.setItem(QKEY, JSON.stringify(cfg))
}

// 글꼴 크기 배율 — html 루트 폰트크기를 바꿔 rem 기반 전 화면이 비례 확대/축소. 1 = 기본(100%).
export function getFontScale() {
  return load().fontScale ?? 1
}
export function setFontScale(scale) {
  save({ ...load(), fontScale: scale })
  applyFontScale(scale)
}
export function applyFontScale(scale) {
  document.documentElement.style.fontSize = `${Math.round((scale || 1) * 100)}%`
}

// 이 기기의 모든 '개인' 앱 데이터 삭제(급수·글꼴·진도·오답·즐겨찾기·내 목록·단어장·학습 계획·이어하기).
// 'hq.' 접두사 키 제거하되, 공휴일 캐시(hq.holidays.*)는 공용 참조 데이터라 보존(재호출 낭비 방지).
export function resetAllData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('hq.') && !k.startsWith('hq.holidays'))
    .forEach((k) => localStorage.removeItem(k))
}

// 표시용 라벨. options = gradeOptions().
export function gradeLabel(grade, only, options) {
  if (grade == null) return '전체'
  const o = options.find((x) => x.grade === grade)
  const name = o ? o.label : `${grade}급`
  return only ? `${name} 배정한자만` : `${name}까지`
}
