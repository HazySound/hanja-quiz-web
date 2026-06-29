// 한자 데이터 로드 + 퀴즈(객관식) 생성.
// 데스크탑 core.py의 이식: 보기(오답)는 '같은 음 / 같은 부수·획수'를 라운드로빈으로
// 섞어 뽑고, 출제 순서는 '덜 풀어본 한자 먼저'(seenCounts 기준).
//
// 데이터(hanja.json) 한 항목: { id, c(글자), seq, rad(부수번호), radc(부수글자), s(획수), r:[[훈,음],...] }

import { seenCounts } from './progress.js'

export const H2R = 'h2r' // 한자 보여주고 훈음 고르기
export const R2H = 'r2h' // 훈음 보여주고 한자 고르기
const N_OPTIONS = 4

let _cache = null
let _index = null

// public/data/hanja.json 로드(최초 1회). vite-plugin-pwa가 오프라인 캐싱.
export async function loadHanja() {
  if (_cache) return _cache
  const res = await fetch(import.meta.env.BASE_URL + 'data/hanja.json')
  if (!res.ok) throw new Error('한자 데이터를 불러오지 못했어요.')
  _cache = (await res.json()).hanja
  return _cache
}

export function readingText(h) {
  return h.r.map(([hun, eum]) => `${hun} ${eum}`).join(' / ')
}

function eums(h) {
  return [...new Set(h.r.map(([, eum]) => eum))]
}

// 같은 음 / 같은 (부수,획수) 색인 — 헷갈리는 보기 후보.
function indexes(all) {
  if (_index) return _index
  const byEum = new Map()
  const byShape = new Map()
  for (const h of all) {
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
  _index = { byEum, byShape }
  return _index
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

function makeH2R(target, all) {
  const { byEum, byShape } = indexes(all)
  const sound = eums(target).flatMap((e) => byEum.get(e) || [])
  const shape = byShape.get(`${target.rad}/${target.s}`) || []
  const distractors = pickDistractors(
    target,
    [sound, shape],
    all,
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

function makeR2H(target, all) {
  const { byEum, byShape } = indexes(all)
  const [hun, eum] = target.r[Math.floor(Math.random() * target.r.length)]
  // 정답과 같은 훈음을 가진 한자는 보기에서 제외(답이 모호해지는 것 방지).
  const sameReading = (h) => h.r.some(([hh, ee]) => hh === hun && ee === eum)
  const shape = byShape.get(`${target.rad}/${target.s}`) || []
  const sound = byEum.get(eum) || []
  const distractors = pickDistractors(
    target,
    [shape, sound],
    all,
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

// 출제 순서: 안 풀어봤거나 적게 풀어본 한자 먼저(동률은 랜덤).
function orderBySeen(all) {
  const seen = seenCounts()
  return shuffle(all).sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0))
}

// 랜덤 풀이 세션 생성. dir: 'mix' | H2R | R2H, count: 문제 수.
export function buildRandomSession(all, { count = 20, dir = 'mix' } = {}) {
  const targets = orderBySeen(all).slice(0, count)
  return targets.map((t) => {
    const d = dir === 'mix' ? (Math.random() < 0.5 ? H2R : R2H) : dir
    return d === H2R ? makeH2R(t, all) : makeR2H(t, all)
  })
}
