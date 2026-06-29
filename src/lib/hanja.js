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
const N_OPTIONS = 4

let _cache = null
let _grades = null

// public/data/hanja.json 로드(최초 1회). vite-plugin-pwa가 오프라인 캐싱.
export async function loadHanja() {
  if (_cache) return _cache
  const res = await fetch(import.meta.env.BASE_URL + 'data/hanja.json')
  if (!res.ok) throw new Error('한자 데이터를 불러오지 못했어요.')
  const json = await res.json()
  _cache = json.hanja
  _grades = json.grades
  return _cache
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

// 출제 순서: 안 풀어봤거나 적게 풀어본 한자 먼저(동률은 랜덤).
function orderBySeen(all) {
  const seen = seenCounts()
  return shuffle(all).sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0))
}

// 랜덤 풀이 세션 생성.
//   fmt: MC|SA, dir(객관식만): 'mix'|H2R|R2H, count: 문제 수,
//   grade: 급수(null=전체), only: 배정한자만 여부.
export function buildRandomSession(all, { count = 20, dir = 'mix', fmt = MC, grade = null, only = false } = {}) {
  const pool = filterByGrade(all, grade, only)
  const targets = orderBySeen(pool).slice(0, count)
  if (fmt === SA) return targets.map((t) => makeSA(t))
  const idx = buildIndexes(pool)
  return targets.map((t) => {
    const d = dir === 'mix' ? (Math.random() < 0.5 ? H2R : R2H) : dir
    return { fmt: MC, ...(d === H2R ? makeH2R(t, pool, idx) : makeR2H(t, pool, idx)) }
  })
}
