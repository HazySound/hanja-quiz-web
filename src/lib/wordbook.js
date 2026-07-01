// 단어장 — 브라우저 localStorage. 데스크탑 wordbook.py의 다중 컬렉션 구조 이식.
//   book(단어장) / wrong(오답 단어) / custom{이름: [...]}.  단어 항목 = { hj, rd, mean }.
// 지금은 book 위주로 쓰고, 전체 컬렉션 UI(목록 화면)는 추후(5번)에.

const KEY = 'hq.wordbook.v1'

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY))
    if (d && Array.isArray(d.book)) {
      d.wrong = d.wrong || []
      d.custom = d.custom || {}
      d.stats = d.stats || {} // { 한자어: { seen, correct } } 출제·정답 횟수
      d.wrongSolved = d.wrongSolved || [] // 오답 단어 중 다시 맞힌 것(한자어 목록)
      return d
    }
  } catch {
    // 무시
  }
  return { book: [], wrong: [], custom: {}, stats: {}, wrongSolved: [] }
}

function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

// coll: 'book' | 'wrong' | ['custom', 이름]
function bucket(data, coll) {
  if (coll === 'book' || coll === 'wrong') return data[coll]
  if (Array.isArray(coll) && coll[0] === 'custom') {
    if (!data.custom[coll[1]]) data.custom[coll[1]] = []
    return data.custom[coll[1]]
  }
  return data.book
}

export function contains(hj, coll = 'book') {
  return bucket(load(), coll).some((w) => w.hj === hj)
}

// 어느 목록(단어장·오답·커스텀)에든 담겨 있나 — 예시단어 칩 금색 표시용.
export function containsAny(hj) {
  const data = load()
  if (data.book.some((w) => w.hj === hj)) return true
  if (data.wrong.some((w) => w.hj === hj)) return true
  return Object.values(data.custom).some((arr) => arr.some((w) => w.hj === hj))
}

export function add(hj, rd, mean = '', coll = 'book') {
  const data = load()
  const b = bucket(data, coll)
  if (!b.some((w) => w.hj === hj)) b.push({ hj, rd, mean })
  save(data)
}

export function remove(hj, coll = 'book') {
  const data = load()
  const b = bucket(data, coll)
  const i = b.findIndex((w) => w.hj === hj)
  if (i >= 0) b.splice(i, 1)
  if (coll === 'wrong') {
    const s = data.wrongSolved.indexOf(hj)
    if (s >= 0) data.wrongSolved.splice(s, 1)
  }
  save(data)
}

// 단어 문제 결과: 출제·정답 횟수 누적 + 오답 단어 갱신.
// 틀리면 '오답 단어'에 적립(맞힘 해제), 맞히면 '맞힘' 표시(자동 제거 X — 직접 정리).
export function recordWord(hj, rd, mean = '', correct) {
  const data = load()
  const s = data.stats[hj] || { seen: 0, correct: 0 }
  data.stats[hj] = { seen: s.seen + 1, correct: s.correct + (correct ? 1 : 0) }
  const inWrong = data.wrong.some((w) => w.hj === hj)
  const si = data.wrongSolved.indexOf(hj)
  if (correct) {
    if (inWrong && si < 0) data.wrongSolved.push(hj)
  } else {
    if (!inWrong) data.wrong.push({ hj, rd, mean })
    if (si >= 0) data.wrongSolved.splice(si, 1)
  }
  save(data)
}

export function wordStats(hj) {
  const s = load().stats[hj]
  return s ? { seen: s.seen, correct: s.correct } : { seen: 0, correct: 0 }
}
export function isWrongSolved(hj) {
  return load().wrongSolved.includes(hj)
}
export function clearSolvedWrongWords() {
  const data = load()
  const solved = new Set(data.wrongSolved)
  data.wrong = data.wrong.filter((w) => !solved.has(w.hj))
  data.wrongSolved = []
  save(data)
}

// 토글: 담겨 있으면 빼고, 없으면 넣는다. 결과(지금 담겨 있나)를 반환.
export function toggle(hj, rd, mean = '', coll = 'book') {
  if (contains(hj, coll)) {
    remove(hj, coll)
    return false
  }
  add(hj, rd, mean, coll)
  return true
}

export function items(coll = 'book') {
  return bucket(load(), coll)
}

export function count(coll = 'book') {
  return bucket(load(), coll).length
}

// 커스텀 단어 목록 이름들 / 생성 / 삭제.
export function customNames() {
  return Object.keys(load().custom)
}
export function customCreate(name) {
  const data = load()
  if (!data.custom[name]) data.custom[name] = []
  save(data)
}
export function customDelete(name) {
  const data = load()
  delete data.custom[name]
  save(data)
}
