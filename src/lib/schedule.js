// 학습 스케줄러 v2 — 캘린더 기반 학습 계획. 범위를 학습일에 자동 분배 + 진도 추적.
// localStorage에 단일 활성 스케줄 저장. DESIGN.md '스케줄러' 모델 확장.
//   schedule = {
//     id, name, scope, ids[],            // 대상 한자(생성 시 고정 순서)
//     start, end,                        // 'YYYY-MM-DD'
//     offDays: { weekends, dates[] },    // 안 하는 날(주말 토글 + 공휴일·휴가 직접 지정)
//     criteria: { items[], quizReps, wordReps },  // 학습 완료 기준(어떤 항목을 해야 완료인지 + 반복수)
//     memo: { [date]: '...' },           // 날짜별 메모
//     studied: { [id]: 'YYYY-MM-DD' },   // 학습 완료 표시(자동/수동)
//   }
// 배정(assignment)은 현재 ids+학습일로 '라이브' 균등분배. (날짜별 수동 이동·분배는 밀림관리 단계에서 stored로.)

import { wrongIds, wrongSolvedIds } from './progress.js'
import * as holidays from './holidays.js'

const KEY = 'hq.schedule.v2'

// ----- 날짜 유틸(로컬 기준, 'YYYY-MM-DD') -----
const pad = (n) => String(n).padStart(2, '0')
export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function parse(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function fmt(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function addDays(s, n) {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return fmt(d)
}
export function diffDays(a, b) {
  return Math.round((parse(b) - parse(a)) / 86400000)
}
export function isWeekend(s) {
  const w = parse(s).getDay()
  return w === 0 || w === 6
}
export function weekdayOf(s) {
  return parse(s).getDay() // 0=일 ~ 6=토
}
export function weekdayLabel(s) {
  return ['일', '월', '화', '수', '목', '금', '토'][weekdayOf(s)]
}
export function mdLabel(s) {
  const [, m, d] = s.split('-')
  return `${Number(m)}/${Number(d)}`
}
export function ymLabel(y, m) {
  return `${y}년 ${m}월`
}

// 한 달 달력 격자: 일요일 시작, 6주(42칸) 고정. [{ date, inMonth }].
export function monthGrid(year, month) {
  const first = `${year}-${pad(month)}-01`
  const startOffset = weekdayOf(first) // 1일의 요일만큼 앞을 이전 달로 채움
  const gridStart = addDays(first, -startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i)
    return { date, inMonth: Number(date.slice(5, 7)) === month }
  })
}

// ----- 저장 -----
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (!s || !s.ids) return null
    return {
      offDays: { weekends: false, dates: [], holidays: false },
      criteria: { items: ['flash', 'quiz'], quizReps: 1, wordReps: 1 },
      memo: {},
      studied: {},
      prog: {},
      assigned: {},
      ...s,
      assigned: s.assigned || {},
      offDays: { weekends: false, dates: [], holidays: false, ...(s.offDays || {}) },
      criteria: { items: ['flash', 'quiz'], quizReps: 1, wordReps: 1, ...(s.criteria || {}) },
      prog: s.prog || {},
    }
  } catch {
    return null
  }
}
function save(s) {
  localStorage.setItem(KEY, JSON.stringify(s))
}
export function exists() {
  return !!load()
}
export function remove() {
  localStorage.removeItem(KEY)
}

// 스케줄 객체 통째로 저장(캘린더 편집기에서 생성·수정 공통). 편집 시 studied를 보존하려면 호출부에서 기존 studied를 넣어 둘 것.
export function commit(sch) {
  save(sch)
  return sch
}

export function create({ name, scope, ids, start, end, includeWeekends, items, quizReps, wordReps }) {
  const s = {
    id: 'sch_' + Date.now(),
    name: name?.trim() || '한자 학습',
    scope: scope || null,
    ids: ids || [],
    start,
    end,
    offDays: { weekends: !includeWeekends, dates: [] },
    criteria: {
      items: items && items.length ? items : ['flash', 'quiz'],
      quizReps: quizReps || 1,
      wordReps: wordReps || 1,
    },
    memo: {},
    studied: {},
    createdAt: todayStr(),
  }
  save(s)
  return s
}

// ----- 진도 -----
export function markStudied(ids, date) {
  const s = load()
  if (!s) return null
  ids.forEach((id) => {
    s.studied[id] = date
  })
  save(s)
  return s
}
export function toggleStudied(id, date) {
  const s = load()
  if (!s) return null
  if (s.studied[id]) delete s.studied[id]
  else s.studied[id] = date
  save(s)
  return s
}

// 수동 완료 해제(되돌리기). 버튼이 처리했던 id들만 정확히 풀 때 사용.
export function unmarkStudied(ids) {
  const s = load()
  if (!s) return null
  ids.forEach((id) => { delete s.studied[id] })
  save(s)
  return s
}

// 완료기준 항목 진행 기록(자동). item: 'flash'(암기 펼침) | 'quiz'(문제 1회) | 'word'(단어 1회).
export function recordItem(id, item) {
  const s = load()
  if (!s) return null
  const p = s.prog[id] || {}
  if (item === 'flash') p.flash = true
  else if (item === 'quiz') p.quiz = (p.quiz || 0) + 1
  else if (item === 'word') p.word = (p.word || 0) + 1
  s.prog[id] = p
  save(s)
  return s
}

// ----- 완료 판정(완료기준 기반) -----
// 한 항목 충족 여부. wrong은 progress(오답노트) 기준: 오답에 안 들었거나, 들었어도 '맞힘'이면 충족.
function metItem(sch, id, item, wrongSet, solvedSet) {
  const p = sch.prog?.[id] || {}
  const c = sch.criteria || {}
  if (item === 'flash') return !!p.flash
  if (item === 'quiz') return (p.quiz || 0) >= (c.quizReps || 1)
  if (item === 'word') return (p.word || 0) >= (c.wordReps || 1)
  if (item === 'wrong') return !wrongSet.has(id) || solvedSet.has(id)
  return true
}
// 완료기준(고른 항목 전부) 충족 여부 — 수동 완료(studied)는 제외한 '실제 학습' 기준.
export function criteriaMet(sch, id, wrongSet, solvedSet) {
  const items = sch.criteria?.items || []
  if (!items.length) return false
  return items.every((it) => metItem(sch, id, it, wrongSet, solvedSet))
}
// 최종 완료: 수동 완료(studied) 또는 완료기준 충족.
export function isDone(sch, id, wrongSet, solvedSet) {
  if (sch.studied?.[id]) return true
  return criteriaMet(sch, id, wrongSet, solvedSet)
}
// UI 표시용 항목별 상태. [{ k, label, met }]. wrong은 오답에 든 경우만 포함.
const ITEM_NAME = { flash: '암기', quiz: '문제', wrong: '오답', word: '단어' }
export function itemStatus(sch, id, wrongSet, solvedSet) {
  const p = sch.prog?.[id] || {}
  const c = sch.criteria || {}
  const out = []
  for (const it of c.items || []) {
    if (it === 'wrong' && !wrongSet.has(id)) continue // 오답에 안 들었으면 표시 안 함
    let label = ITEM_NAME[it]
    if (it === 'quiz') label = `문제 ${Math.min(p.quiz || 0, c.quizReps || 1)}/${c.quizReps || 1}`
    else if (it === 'word') label = `단어 ${Math.min(p.word || 0, c.wordReps || 1)}/${c.wordReps || 1}`
    out.push({ k: it, label, met: metItem(sch, id, it, wrongSet, solvedSet) })
  }
  return out
}
// 현재 오답/맞힘 집합(진도판정용 1회 생성).
export function wrongSets() {
  return { wrongSet: new Set(wrongIds()), solvedSet: new Set(wrongSolvedIds()) }
}

// ----- 쉬는 날 / 메모 -----
export function toggleRestDay(date) {
  const s = load()
  if (!s) return null
  const set = new Set(s.offDays.dates || [])
  if (set.has(date)) set.delete(date)
  else set.add(date)
  s.offDays.dates = [...set].sort()
  save(s)
  return s
}
export function setMemo(date, text) {
  const s = load()
  if (!s) return null
  if (text && text.trim()) s.memo[date] = text
  else delete s.memo[date]
  save(s)
  return s
}

// ----- 계획 계산(순수) -----
// 학습일: 기간 내, 주말정책·휴가/공휴일(offDays.dates) 제외한 날짜 배열.
export function studyDays(sch) {
  const out = []
  if (!sch?.start || !sch?.end || sch.start > sch.end) return out
  const off = new Set(sch.offDays?.dates || [])
  const skipWeekend = !!sch.offDays?.weekends
  const hset = sch.offDays?.holidays ? holidays.cachedSet(yearsOf(sch)) : null // 공휴일 제외(캐시 기반)
  let cur = sch.start
  let guard = 0
  while (cur <= sch.end && guard < 4000) {
    guard++
    if (!(skipWeekend && isWeekend(cur)) && !off.has(cur) && !(hset && hset.has(cur))) out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

// 계획이 걸친 연도들(공휴일 prefetch·조회용). start ~ effectiveEnd.
export function yearsOf(sch) {
  if (!sch?.start) return []
  const a = Number(sch.start.slice(0, 4))
  const b = Number(effectiveEnd(sch).slice(0, 4))
  const out = []
  for (let y = a; y <= b && y - a < 10; y++) out.push(y)
  return out
}

// 한자 id들을 학습일 수만큼 균등 분배 → [{ date, ids[] }].
export function autoDistribute(ids, days) {
  const N = ids.length
  const D = days.length
  if (!D) return []
  return days.map((date, i) => ({
    date,
    ids: ids.slice(Math.floor((i * N) / D), Math.floor(((i + 1) * N) / D)),
  }))
}

// 각 한자의 '예정 날짜' 계산: 기본은 학습일 균등분배(auto), assigned[id]가 있으면 그 날짜로 덮어씀(밀림 관리).
// 반환: { map: Map(date -> id[]), idDate: { id -> date } }. (id 순서는 sch.ids 순서 유지)
export function plannedMap(sch) {
  const idDate = {}
  for (const d of autoDistribute(sch.ids, studyDays(sch))) for (const id of d.ids) idDate[id] = d.date
  const ov = sch.assigned || {}
  const idSet = new Set(sch.ids.map(String)) // assigned 키는 항상 문자열 — id가 숫자여도 매칭되게 정규화
  for (const id in ov) if (idSet.has(id)) idDate[id] = ov[id]
  const map = new Map()
  for (const id of sch.ids) {
    const date = idDate[id]
    if (!date) continue
    if (!map.has(date)) map.set(date, [])
    map.get(date).push(id)
  }
  return { map, idDate }
}

// 날짜 → 배정 한자 id[] 맵(달력 셀 조회용).
export function assignmentMap(sch) {
  return plannedMap(sch).map
}

// override를 포함한 '실제 종료일'(가장 늦은 배정 날짜). 표시·D-day용. auto 분배 범위는 sch.end 그대로 유지.
export function effectiveEnd(sch) {
  let e = sch.end
  for (const d of Object.values(sch.assigned || {})) if (d > e) e = d
  return e
}

// ----- 밀림 관리 -----
// 선택 한자들을 특정 날짜(들)에 재배치. idToDate = { id: 'YYYY-MM-DD' }.
// sch.end(auto 분배 범위)는 건드리지 않음 — 종료일 밖으로 옮긴 날엔 auto가 안 깔려 이중 카운트 방지. 표시 종료일은 effectiveEnd로.
export function reassign(idToDate) {
  const s = load()
  if (!s) return null
  s.assigned = { ...(s.assigned || {}), ...idToDate }
  save(s)
  return s
}

// 자동 미루기: 미완료 한자를 오늘부터 '원래 하루 분량'씩 학습일에 다시 깔고, 모자라면 종료일 연장.
export function autoPostpone(today) {
  const s = load()
  if (!s) return null
  const { wrongSet, solvedSet } = wrongSets()
  const undone = s.ids.filter((id) => !isDone(s, id, wrongSet, solvedSet))
  if (!undone.length) return s
  const baseCount = studyDays(s).length
  const perDay = Math.max(1, Math.ceil(s.ids.length / Math.max(1, baseCount)))
  const off = new Set(s.offDays?.dates || [])
  const skipWeekend = !!s.offDays?.weekends
  const isStudyDate = (d) => !(skipWeekend && isWeekend(d)) && !off.has(d)
  const assigned = { ...(s.assigned || {}) }
  let cur = today < s.start ? s.start : today
  let placed = 0
  let guard = 0
  while (placed < undone.length && guard < 20000) {
    guard++
    if (isStudyDate(cur)) {
      for (let k = 0; k < perDay && placed < undone.length; k++) assigned[undone[placed++]] = cur
    }
    cur = addDays(cur, 1)
  }
  s.assigned = assigned // sch.end은 유지(override가 표시 종료일 결정 = effectiveEnd)
  save(s)
  return s
}

// 한 날짜 상태(달력 셀 색). today 기준.
//   'off'(쉼) | 'done' | 'missed' | 'today' | 'future' | 'none'(기간 밖)
export function dayStatus(sch, date, today, dayIds, isStudy) {
  if (!sch || date < sch.start || date > sch.end) return 'none'
  if (!isStudy) return 'off'
  if (date === today) return 'today'
  if (date < today) {
    const { wrongSet, solvedSet } = wrongSets()
    return dayIds.every((id) => isDone(sch, id, wrongSet, solvedSet)) ? 'done' : 'missed'
  }
  return 'future'
}

// today 기준 종합: 오늘 분량·밀림·진도·날짜별 상태.
export function buildPlan(sch, today) {
  const { map, idDate } = plannedMap(sch)
  const { wrongSet, solvedSet } = wrongSets()
  const done = (id) => isDone(sch, id, wrongSet, solvedSet)
  const total = sch.ids.length
  const doneCount = sch.ids.filter(done).length

  const dates = [...map.keys()].sort()
  const perDay = dates.map((date) => {
    const dayIds = map.get(date)
    const dn = dayIds.filter(done).length
    const status = date < today ? (dn >= dayIds.length ? 'done' : 'missed') : date === today ? 'today' : 'future'
    return { date, ids: dayIds, done: dn, total: dayIds.length, status }
  })

  const todayIds = map.get(today) || []
  const overdue = sch.ids.filter((id) => idDate[id] && idDate[id] < today && !done(id))
  const dueIds = [...overdue, ...todayIds.filter((id) => !done(id))]
  const days = studyDays(sch)

  return {
    days,
    perDay,
    total,
    doneCount,
    todayIds,
    overdue,
    dueIds,
    displayIds: [...overdue, ...todayIds],
    nextDay: dates.find((d) => d > today) || null,
    isStudyDay: days.includes(today),
    started: today >= sch.start,
    ended: today > effectiveEnd(sch),
  }
}

// 완료 기준 라벨(표시용).
const ITEM_LABEL = { flash: '암기', quiz: '문제', wrong: '오답노트', word: '단어' }
export function itemLabel(k) {
  return ITEM_LABEL[k] || k
}
export function criteriaLabel(sch) {
  const c = sch.criteria || {}
  return (c.items || []).map((k) => ITEM_LABEL[k] || k).join('·') || '—'
}
