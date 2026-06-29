// 학습 진행도 — 브라우저 localStorage에 저장(오프라인·기기 로컬).
// 데스크탑의 srs.seen(출제 횟수) + 오답 노트를 최소 형태로 옮긴 것.
//   seen:  { [hanjaId]: 출제횟수 }  → '덜 푼 것 우선' 출제에 사용
//   wrong: [hanjaId, ...]           → 오답 노트(맞히면 빠지고 틀리면 추가)

const KEY = 'hq.progress.v1'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { seen: {}, wrong: [] }
  } catch {
    return { seen: {}, wrong: [] }
  }
}

function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function seenCounts() {
  return load().seen
}

export function wrongIds() {
  return load().wrong
}

// 한 문제 결과 반영: 출제횟수 +1, 오답 노트 갱신.
export function record(hanjaId, correct) {
  const data = load()
  data.seen[hanjaId] = (data.seen[hanjaId] || 0) + 1
  const i = data.wrong.indexOf(hanjaId)
  if (correct) {
    if (i >= 0) data.wrong.splice(i, 1)
  } else if (i < 0) {
    data.wrong.push(hanjaId)
  }
  save(data)
}
