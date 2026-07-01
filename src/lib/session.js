// 진행 중 학습 세션 저장 — 중단했다가 '이어서 하기'로 복귀(덱/문제는 그대로, 위치만 기억).
// 슬롯 2개: flash(암기) / quiz(문제). 메인의 '이어서 하기' 버튼과 오늘 학습 진입에서 사용.
//   flash: { kind:'flash', deckIds:[...], index, scheduleMark }
//   quiz:  { kind:'quiz', questions:[...], qi, results:[...], fmt, dir, scheduleMark }

const KEY = 'hq.session.v1'

function all() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
export function load(kind) {
  return all()[kind] || null
}
export function save(kind, s) {
  const a = all()
  // 저장(=학습 활동)할 때마다 dismissed 해제 → ✕로 숨겼어도 다시 하다 나오면 메인에 재생성.
  a[kind] = { ...s, dismissed: false, ts: Date.now() }
  localStorage.setItem(KEY, JSON.stringify(a))
}
export function clear(kind) {
  const a = all()
  delete a[kind]
  localStorage.setItem(KEY, JSON.stringify(a))
}
// 메인 '이어서' 버튼만 숨김(진행 내역은 그대로 — 오늘 학습 재진입 시 이어짐).
export function dismiss(kind) {
  const a = all()
  if (a[kind]) {
    a[kind].dismissed = true
    localStorage.setItem(KEY, JSON.stringify(a))
  }
}
// 마지막에 하던 세션 하나(있으면). 메인에 그것만 이어서 표시.
export function latest() {
  const a = all()
  const list = ['flash', 'quiz', 'word'].filter((k) => a[k]).map((k) => ({ ...a[k], kind: k }))
  list.sort((x, y) => (y.ts || 0) - (x.ts || 0))
  return list[0] || null
}
