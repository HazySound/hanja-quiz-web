// 한자 데이터 로드 + 퀴즈(객관식) 생성.
// 데스크탑 core.py의 이식: 보기(오답)는 '같은 음 / 같은 부수·획수'를 라운드로빈으로
// 섞어 뽑고, 출제 순서는 '덜 풀어본 한자 먼저'(seenCounts 기준).
//
// 데이터(hanja.json) 한 항목: { id, c(글자), seq, rad(부수번호), radc(부수글자), s(획수), r:[[훈,음],...] }

import { seenCounts } from './progress.js'

export const H2R = 'h2r' // 한자 보여주고 훈음 고르기
export const R2H = 'r2h' // 훈음 보여주고 한자 고르기
export const MC = 'mc' // 객관식
export const SA = 'sa' // 단답식
export const WORD = 'word' // 단어형(한자어 읽기 입력)
const N_OPTIONS = 4

let _cache = null
let _grades = null
let _byChar = null // 글자 -> hanja (전체 색인)
let _examples = null // 글자 -> [[한자어, 읽기, 뜻], ...]
let _radicals = null // 부수번호 -> { num, char, label }

// public/data/hanja.json(+radicals) 로드(최초 1회). vite-plugin-pwa가 오프라인 캐싱.
export async function loadHanja() {
  if (_cache) return _cache
  const [json, rad] = await Promise.all([
    fetch(import.meta.env.BASE_URL + 'data/hanja.json').then((r) => {
      if (!r.ok) throw new Error('한자 데이터를 불러오지 못했어요.')
      return r.json()
    }),
    fetch(import.meta.env.BASE_URL + 'data/radicals.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
  ])
  _cache = json.hanja
  _grades = json.grades
  _byChar = new Map(_cache.map((h) => [h.c, h]))
  _radicals = new Map(rad.map((x) => [x.num, x]))
  return _cache
}

// 예시 단어 데이터 로드(단어형·정답 예시·한자 상세에서 사용). 1회.
export async function loadExamples() {
  if (_examples) return _examples
  const res = await fetch(import.meta.env.BASE_URL + 'data/examples.json')
  _examples = res.ok ? await res.json() : {}
  return _examples
}

// 한 글자의 예시 단어들 [[한자어, 읽기, 뜻], ...] (없으면 빈 배열).
export function wordsFor(ch) {
  return _examples?.[ch] || []
}

// 글자 ch의 훈음 중 eum과 일치하는 것을 "훈 음" 문자열로(없으면 첫 훈음). 단어 풀이 표시용.
export function readingFor(ch, eum) {
  const h = _byChar?.get(ch)
  if (!h || !h.r.length) return eum || ''
  const m = h.r.find(([, e]) => e === eum) || h.r[0]
  return `${m[0]} ${m[1]}`
}

// id 목록 → 한자 객체들(순서 유지). 오답·즐겨찾기 목록 표시용.
export function hanjaByIds(all, ids) {
  const byId = new Map(all.map((h) => [h.id, h]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

// 표시용 예시 단어: 음가 일치 우선, 2~3자 우선(사자성어 후순위), 상위 limit개.
// (퀴즈 정답 공개·한자 상세에서 사용. readingMatches는 아래에 정의 — 함수 선언이라 호이스팅됨)
export function exampleWords(ch, limit = 4) {
  const words = wordsFor(ch)
  if (!words.length) return []
  const good = words.filter((w) => readingMatches(w[0], w[1]))
  const base = good.length ? good : words
  return [...base].sort((a, b) => (a[0].length >= 4 ? 1 : 0) - (b[0].length >= 4 ? 1 : 0)).slice(0, limit)
}

// 급수 선택 옵션 [{ grade, label, desc }] (9급~1급).
export function gradeOptions() {
  return _grades?.options || []
}

// 급수 필터. grade=null이면 전체. (급수 번호: 9=쉬움 ~ 1=어려움)
//   only=false(누적): g >= grade — 더 쉬운 급수까지 포함(예: 5급 → 5~9급).
//   only=true(배정한자만): g === grade — 그 급수에 배정된 글자만.
export function filterByGrade(all, grade, only) {
  if (grade == null) return all
  return all.filter((h) => (only ? h.g === grade : h.g >= grade))
}

// 음가 초성(챕터 분류용). core.py chosung_of 이식.
const CHOSUNG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
export function chosungOf(syl) {
  if (!syl) return '?'
  const code = syl.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return CHOSUNG[Math.floor((code - 0xac00) / 588)]
  return '?'
}
function initialOf(h) {
  return h.r.length ? chosungOf(h.r[0][1]) : '?' // 대표음(첫 훈음의 음)의 초성
}

// 범위 필터(급수+음가+부수+획수). 출제 풀·poolCount·덱에 공통.
// 음가·부수는 단일(initial/radical, 챕터 퀵실행) 또는 복수(initials/radicals, 범위빌더) 모두 지원.
export function filterPool(all, { grade = null, only = false, initial = null, initials = null, radical = null, radicals = null, strokesMin = null, strokesMax = null, ids = null } = {}) {
  if (ids && ids.length) {
    const byId = new Map(all.map((h) => [h.id, h]))
    return ids.map((id) => byId.get(id)).filter(Boolean) // 명시 목록 — 전달된 id 순서 보존(order:'asis'와 함께 '미완료 우선' 등 가능)
  }
  let pool = filterByGrade(all, grade, only)
  if (initial) pool = pool.filter((h) => initialOf(h) === initial)
  if (initials && initials.length) pool = pool.filter((h) => initials.includes(initialOf(h)))
  if (radical) pool = pool.filter((h) => h.rad === radical) // 부수번호(num)
  if (radicals && radicals.length) pool = pool.filter((h) => radicals.includes(h.rad))
  if (strokesMin != null) pool = pool.filter((h) => h.s && h.s >= strokesMin)
  if (strokesMax != null) pool = pool.filter((h) => h.s && h.s <= strokesMax)
  return pool
}

// 부수 목록: [{ num, char, label, count }] (부수번호 순). 급수 필터 반영. 부수 picker용.
export function radicalsList(all, grade = null, only = false) {
  const pool = filterByGrade(all, grade, only)
  const m = new Map()
  for (const h of pool) {
    if (!h.rad) continue
    m.set(h.rad, (m.get(h.rad) || 0) + 1)
  }
  return [...m.entries()]
    .map(([num, count]) => {
      const info = _radicals?.get(num)
      return { num, char: info?.char || '?', label: info?.label || '', count }
    })
    .sort((a, b) => a.num - b.num)
}

// 획수 최소~최대. 급수 필터 반영.
export function strokeRange(all, grade = null, only = false) {
  const pool = filterByGrade(all, grade, only)
  let min = Infinity
  let max = 0
  for (const h of pool)
    if (h.s) {
      if (h.s < min) min = h.s
      if (h.s > max) max = h.s
    }
  return max ? [min, max] : [1, 30]
}

// 정렬: 'seq'(가나다/음가순) | 'strokes'(획수순) | 'random' | 'seen'(덜 본 것 먼저, 기본).
function orderPool(pool, order) {
  if (order === 'asis') return pool // 전달된 순서 그대로(미완료 우선 등 호출부에서 정렬)
  if (order === 'seq') return [...pool].sort((a, b) => a.seq - b.seq)
  if (order === 'strokes') return [...pool].sort((a, b) => (a.s || 0) - (b.s || 0) || a.seq - b.seq)
  if (order === 'random') return shuffle(pool)
  return orderBySeen(pool)
}

// Scope → 한자 목록(필터+정렬+개수). 암기/문제 공통. DESIGN.md 참고.
export function resolveScope(all, scope = {}) {
  const { order = 'seen', count = null } = scope
  const pool = orderPool(filterPool(all, scope), order) // filterPool이 scope에서 필요한 필드만 읽음
  return count ? pool.slice(0, count) : pool
}

// 음가 챕터 목록: [{ initial, count }] (ㄱ~ㅎ 순, 존재하는 것만). 급수 필터 반영.
export function chapters(all, grade = null, only = false) {
  const pool = filterByGrade(all, grade, only)
  const counts = new Map()
  for (const h of pool) {
    const ini = initialOf(h)
    counts.set(ini, (counts.get(ini) || 0) + 1)
  }
  const out = [...CHOSUNG].filter((c) => counts.get(c)).map((c) => ({ initial: c, count: counts.get(c) }))
  if (counts.get('?')) out.push({ initial: '?', count: counts.get('?') })
  return out
}

export function readingText(h) {
  return h.r.map(([hun, eum]) => `${hun} ${eum}`).join(' / ')
}

function eums(h) {
  return [...new Set(h.r.map(([, eum]) => eum))]
}

// 같은 음 / 같은 (부수,획수) 색인 — 헷갈리는 보기 후보. 출제 풀(급수 필터된 집합)
// 기준으로 매번 새로 만든다(보기도 선택 급수 안에서 나오게).
function buildIndexes(pool) {
  const byEum = new Map()
  const byShape = new Map()
  for (const h of pool) {
    for (const e of eums(h)) {
      if (!byEum.has(e)) byEum.set(e, [])
      byEum.get(e).push(h)
    }
    if (h.rad && h.s) {
      const k = `${h.rad}/${h.s}`
      if (!byShape.has(k)) byShape.set(k, [])
      byShape.get(k).push(h)
    }
  }
  return { byEum, byShape }
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// core.py _pick_distractors: 여러 후보 풀을 라운드로빈으로 섞어 need개 채우고,
// 모자라면 전체에서 랜덤 보충. key로 중복 제거, exclude로 모호한 후보 배제.
function pickDistractors(target, pools, all, key, need, exclude) {
  const chosen = []
  const used = new Set([key(target)])
  const ok = (x) => !used.has(key(x)) && !(exclude && exclude(x))

  const queues = pools.map((p) => shuffle(p.filter((x) => key(x) !== key(target) && !(exclude && exclude(x)))))
  let pi = 0
  let guard = 0
  while (chosen.length < need && queues.some((q) => q.length) && guard < 10000) {
    guard++
    const q = queues[pi % queues.length]
    pi++
    if (q.length) {
      const x = q.shift()
      if (ok(x)) {
        chosen.push(x)
        used.add(key(x))
      }
    }
  }
  if (chosen.length < need) {
    for (const x of shuffle(all)) {
      if (chosen.length >= need) break
      if (ok(x)) {
        chosen.push(x)
        used.add(key(x))
      }
    }
  }
  return chosen
}

function makeH2R(target, pool, idx) {
  const { byEum, byShape } = idx
  const sound = eums(target).flatMap((e) => byEum.get(e) || [])
  const shape = byShape.get(`${target.rad}/${target.s}`) || []
  const distractors = pickDistractors(
    target,
    [sound, shape],
    pool,
    readingText,
    N_OPTIONS - 1,
  )
  const pairs = shuffle([target, ...distractors])
  const answer = readingText(target)
  return {
    dir: H2R,
    prompt: target.c, // 한자 글자
    sub: '이 한자의 훈·음은?',
    options: pairs.map(readingText),
    notes: pairs.map((h) => h.c), // 정답 확인 시 그 훈음의 실제 한자
    answerIndex: pairs.map(readingText).indexOf(answer),
    char: target.c,
    hanjaId: target.id,
  }
}

function makeR2H(target, pool, idx) {
  const { byEum, byShape } = idx
  const [hun, eum] = target.r[Math.floor(Math.random() * target.r.length)]
  // 정답과 같은 훈음을 가진 한자는 보기에서 제외(답이 모호해지는 것 방지).
  const sameReading = (h) => h.r.some(([hh, ee]) => hh === hun && ee === eum)
  const shape = byShape.get(`${target.rad}/${target.s}`) || []
  const sound = byEum.get(eum) || []
  const distractors = pickDistractors(
    target,
    [shape, sound],
    pool,
    (h) => h.c,
    N_OPTIONS - 1,
    sameReading,
  )
  const pairs = shuffle([target, ...distractors])
  return {
    dir: R2H,
    prompt: `${hun} ${eum}`, // 훈음 텍스트
    sub: '훈·음에 맞는 한자는?',
    options: pairs.map((h) => h.c),
    notes: pairs.map(readingText), // 정답 확인 시 그 한자의 훈음
    answerIndex: pairs.indexOf(target),
    char: target.c,
    hanjaId: target.id,
  }
}

// 단답식: 한자 보여주고 훈·음을 직접 입력. 훈음이 N개면 입력칸 N개.
function makeSA(target) {
  const answers = target.r.map(([hun, eum]) => `${hun} ${eum}`)
  return {
    fmt: SA,
    dir: H2R,
    prompt: target.c,
    sub: answers.length > 1 ? `훈·음을 입력하세요 (훈음 ${answers.length}개)` : '훈·음을 입력하세요',
    answers,
    char: target.c,
    hanjaId: target.id,
  }
}

function normalize(s) {
  return s.replace(/ /g, '').trim()
}

// core.py grade_sa 이식: 입력들 ↔ 정답 훈음 집합을 순서 무관 최대 이분매칭(증가경로).
// 빈칸/오타/중복은 오답. (사전 캐시 기반 대체표현 alts는 추후 — 지금은 정답 그대로만 인정)
export function gradeSA(answers, inputs) {
  const accept = answers.map((a) => new Set([normalize(a)]))
  const norm = inputs.map(normalize)
  const slotFor = new Array(accept.length).fill(-1)
  const augment = (i, seen) => {
    for (let j = 0; j < accept.length; j++) {
      if (norm[i] && accept[j].has(norm[i]) && !seen.has(j)) {
        seen.add(j)
        if (slotFor[j] === -1 || augment(slotFor[j], seen)) {
          slotFor[j] = i
          return true
        }
      }
    }
    return false
  }
  for (let i = 0; i < inputs.length; i++) augment(i, new Set())
  const matched = new Set(slotFor.filter((x) => x !== -1))
  const per = inputs.map((_, i) => matched.has(i))
  const allOk = per.every(Boolean) && slotFor.every((j) => j !== -1)
  return { allOk, per }
}

// 두음법칙: 대표음 eum이 어두에서 바뀔 수 있는 음들(원형 포함). core.py _dueum_variants 이식.
const Y_JUNG = new Set([2, 3, 6, 7, 12, 17, 20]) // ㅑㅒㅕㅖㅛㅠㅣ
function dueumVariants(eum) {
  const out = new Set([eum])
  if (!eum) return out
  const code = eum.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return out
  const c = code - 0xac00
  const cho = Math.floor(c / 588)
  const jung = Math.floor((c % 588) / 28)
  const jong = c % 28
  if (cho === 5) {
    // ㄹ -> (ㅣ/반모음)ㅇ, 그 외 ㄴ
    out.add(String.fromCharCode(0xac00 + (((Y_JUNG.has(jung) ? 11 : 2) * 21 + jung) * 28 + jong)))
  } else if (cho === 2 && Y_JUNG.has(jung)) {
    // ㄴ + ㅣ/반모음 -> ㅇ
    out.add(String.fromCharCode(0xac00 + ((11 * 21 + jung) * 28 + jong)))
  }
  return out
}

// 단어 한자표기 hj와 한글읽기 rd의 음가가 맞는지(대표음+두음 허용). core.py reading_matches 이식.
function readingMatches(hj, rd) {
  if (hj.length !== rd.length) return true
  for (let i = 0; i < hj.length; i++) {
    const h = _byChar?.get(hj[i])
    if (!h || !h.r.length) continue
    if (!h.r.some(([, eum]) => dueumVariants(eum).has(rd[i]))) return false
  }
  return true
}

// ch가 든 출제 가능한 한자어 후보들 [[한자어,읽기,뜻],...] (2~3자, 음가 일치).
function wordCandidates(ch) {
  return wordsFor(ch).filter(
    (w) =>
      w[0].length >= 2 &&
      w[0].length <= 3 &&
      w[0].length === w[1].length &&
      w[0].includes(ch) &&
      readingMatches(w[0], w[1]),
  )
}

// 단어형 문제: 후보 중 2자 우선, 상위 3개(흔한 단어 위주) 중 랜덤. 없으면 한 글자=대표음 폴백.
function makeWord(target) {
  const cands = wordCandidates(target.c)
  let w
  if (cands.length) {
    const two = cands.filter((c) => c[0].length === 2)
    const pool = (two.length ? two : cands).slice(0, 3)
    w = pool[Math.floor(Math.random() * pool.length)]
  } else {
    w = [target.c, target.r[0][1], '']
  }
  return {
    fmt: WORD,
    dir: H2R,
    prompt: w[0], // 한자어(한자만 표시)
    sub: '단어를 읽어 보세요',
    answers: [w[1]], // 읽기 — gradeSA로 채점
    word: w, // [한자어, 읽기, 뜻]
    char: target.c,
    hanjaId: target.id,
  }
}

// 플래시카드 덱 = Scope 해석(범위 빌더가 만든 scope를 그대로).
export function buildDeck(all, scope = {}) {
  return resolveScope(all, scope)
}

// 출제 순서: 안 풀어봤거나 적게 풀어본 한자 먼저(동률은 랜덤).
function orderBySeen(all) {
  const seen = seenCounts()
  return shuffle(all).sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0))
}

// 랜덤 풀이 세션 생성.
//   fmt: MC|SA, dir(객관식만): 'mix'|H2R|R2H, count: 문제 수,
//   grade: 급수(null=전체), only: 배정한자만 여부.
// Scope 기반 세션. scope = 범위빌더 결과(+grade/only). 암기/문제 공통 토대(DESIGN.md).
export function buildSession(all, { scope = {}, dir = 'mix', fmt = MC } = {}) {
  const { count = null, order = 'seen', grade = null, only = false } = scope
  const scoped = filterPool(all, scope) // 범위 내 한자(출제 대상)
  let pool = orderPool(scoped, order)
  if (fmt === WORD) pool = pool.filter((t) => wordCandidates(t.c).length > 0) // 단어 있는 글자만
  const targets = count ? pool.slice(0, count) : pool
  if (fmt === SA) return targets.map((t) => makeSA(t))
  if (fmt === WORD) return targets.map((t) => makeWord(t))
  // 보기(오답)도 선택 범위 안에서 우선(부수/획수 필터가 보기에도 반영). 너무 적으면 급수 전체로 보충.
  const dPool = scoped.length >= N_OPTIONS ? scoped : filterByGrade(all, grade, only)
  const idx = buildIndexes(dPool)
  return targets.map((t) => {
    const d = dir === 'mix' ? (Math.random() < 0.5 ? H2R : R2H) : dir
    return { fmt: MC, ...(d === H2R ? makeH2R(t, dPool, idx) : makeR2H(t, dPool, idx)) }
  })
}
