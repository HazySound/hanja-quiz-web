// 학습 진행도 — 브라우저 localStorage에 저장(오프라인·기기 로컬).
// 데스크탑의 srs.seen(출제 횟수) + 오답 노트를 최소 형태로 옮긴 것.
//   seen:  { [hanjaId]: 출제횟수 }  → '덜 푼 것 우선' 출제에 사용
//   wrong: [hanjaId, ...]           → 오답 노트(틀리면 추가, 자동 제거 X — 사용자가 직접 뺀다)
//   wrongSolved: [hanjaId, ...]     → 오답 노트 중 다시 맞힌 것(표시·일괄정리용)

const KEY = 'hq.progress.v1'

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) || {}
    return {
      seen: d.seen || {}, // 출제 횟수
      correct: d.correct || {}, // 정답 횟수
      wrong: d.wrong || [],
      fav: d.fav || [],
      wrongSolved: d.wrongSolved || [],
      custom: d.custom || {}, // 커스텀 한자목록 { 이름: [id...] }
    }
  } catch {
    return { seen: {}, correct: {}, wrong: [], fav: [], wrongSolved: [], custom: {} }
  }
}

function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function seenCounts() {
  return load().seen
}

// 한자별 출제·정답 횟수(풀이 화면 표시용).
export function statsOf(id) {
  const d = load()
  return { seen: d.seen[id] || 0, correct: d.correct[id] || 0 }
}

export function wrongIds() {
  return load().wrong
}

// 오답 노트 중 다시 맞힌 것들(자동 제거 X, 표시만).
export function wrongSolvedIds() {
  return load().wrongSolved
}

export function removeWrong(id) {
  const data = load()
  const i = data.wrong.indexOf(id)
  if (i >= 0) data.wrong.splice(i, 1)
  const s = data.wrongSolved.indexOf(id)
  if (s >= 0) data.wrongSolved.splice(s, 1)
  save(data)
}

// 맞힌 것 일괄 제거(오답 노트 정리).
export function clearSolvedWrong() {
  const data = load()
  const solved = new Set(data.wrongSolved)
  data.wrong = data.wrong.filter((id) => !solved.has(id))
  data.wrongSolved = []
  save(data)
}

// 목록에 직접 추가(다중선택 → 다른 목록에 담기). 이미 있으면 그대로.
export function addWrong(id) {
  const data = load()
  if (!data.wrong.includes(id)) {
    data.wrong.push(id)
    save(data)
  }
}
export function addFavorite(id) {
  const data = load()
  if (!data.fav.includes(id)) {
    data.fav.push(id)
    save(data)
  }
}

// 즐겨찾기(한자 id 목록)
export function favoriteIds() {
  return load().fav
}
export function isFavorite(id) {
  return load().fav.includes(id)
}
export function toggleFavorite(id) {
  const data = load()
  const i = data.fav.indexOf(id)
  if (i >= 0) data.fav.splice(i, 1)
  else data.fav.push(id)
  save(data)
  return i < 0 // 지금 즐겨찾기인지
}

// ----- 커스텀 한자목록 (단어장 담기처럼, 한자를 직접 만든 목록에 담기) -----
export function customNames() {
  return Object.keys(load().custom)
}
export function customIds(name) {
  return load().custom[name] || []
}
export function customCreate(name) {
  const data = load()
  if (!data.custom[name]) {
    data.custom[name] = []
    save(data)
  }
}
export function customDelete(name) {
  const data = load()
  delete data.custom[name]
  save(data)
}
export function inCustom(id, name) {
  return (load().custom[name] || []).includes(id)
}
// 담기/빼기 토글. 목록이 없으면 만든다. 반환=지금 담겨있는지.
export function toggleCustom(id, name) {
  const data = load()
  const list = data.custom[name] || (data.custom[name] = [])
  const i = list.indexOf(id)
  if (i >= 0) list.splice(i, 1)
  else list.push(id)
  save(data)
  return i < 0
}
export function addCustom(id, name) {
  const data = load()
  const list = data.custom[name] || (data.custom[name] = [])
  if (!list.includes(id)) {
    list.push(id)
    save(data)
  }
}
export function removeCustom(id, name) {
  const data = load()
  const list = data.custom[name]
  if (list) {
    const i = list.indexOf(id)
    if (i >= 0) {
      list.splice(i, 1)
      save(data)
    }
  }
}
// 즐겨찾기 또는 커스텀 목록 어디든 담겨있으면 true(별 색칠용).
export function inAnyList(id) {
  const d = load()
  return d.fav.includes(id) || Object.values(d.custom).some((list) => list.includes(id))
}

// 한 문제 결과 반영: 출제횟수 +1, 오답 노트 갱신.
// 맞혀도 오답 노트에서 자동으로 빼지 않는다 — '맞힘' 표시만(wrongSolved). 반복 학습 후 직접 정리.
export function record(hanjaId, correct) {
  const data = load()
  data.seen[hanjaId] = (data.seen[hanjaId] || 0) + 1
  if (correct) data.correct[hanjaId] = (data.correct[hanjaId] || 0) + 1
  const wi = data.wrong.indexOf(hanjaId)
  const si = data.wrongSolved.indexOf(hanjaId)
  if (correct) {
    if (wi >= 0 && si < 0) data.wrongSolved.push(hanjaId) // 오답 노트에 있으면 '맞힘' 표시
  } else {
    if (wi < 0) data.wrong.push(hanjaId)
    if (si >= 0) data.wrongSolved.splice(si, 1) // 다시 틀리면 맞힘 해제
  }
  save(data)
}
