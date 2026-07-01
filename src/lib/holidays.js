// 공휴일 데이터 — Netlify Function 프록시에서 연도별로 받아 localStorage에 캐싱.
//  · 평소엔 캐시(네트워크 0). 캐시가 TTL(1일) 지났으면 백그라운드로 갱신 → 대체공휴일 등 변경도 곧 반영.
//  · 오프라인이면 마지막 캐시 사용. 함수 미배포(개발 중)면 조용히 실패 → 공휴일 없음으로 동작.
//  · studyDays(순수·동기)에서 쓰도록 cachedSet()은 동기로 캐시만 읽는다(prefetch가 먼저 채움).

const FN = '/.netlify/functions/holidays'
const TTL = 24 * 60 * 60 * 1000 // 1일
const cacheKey = (y) => `hq.holidays.${y}`
const _mem = {} // year -> { dates, names, fetchedAt }

function readCache(y) {
  if (_mem[y]) return _mem[y]
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey(y)))
    if (c) _mem[y] = c
    return c
  } catch {
    return null
  }
}

// 주어진 연도들의 공휴일을 확보(필요 시 갱신). await로 완료 후 re-render하면 cachedSet이 채워진 상태.
export async function prefetch(years) {
  await Promise.all(
    [...new Set(years)].map(async (y) => {
      const c = readCache(y)
      if (c && Date.now() - (c.fetchedAt || 0) < TTL) return // 신선 → 통과
      try {
        const r = await fetch(`${FN}?year=${y}`)
        if (!r.ok) return
        const j = await r.json()
        const rec = { dates: j.dates || [], names: j.names || {}, fetchedAt: Date.now() }
        _mem[y] = rec
        localStorage.setItem(cacheKey(y), JSON.stringify(rec))
      } catch {
        /* 오프라인/미배포 → 기존 캐시 유지 */
      }
    }),
  )
}

// 동기: 캐시된 공휴일 날짜 Set('YYYY-MM-DD'). studyDays용.
export function cachedSet(years) {
  const s = new Set()
  for (const y of years) {
    const c = readCache(y)
    if (c?.dates) for (const d of c.dates) s.add(d)
  }
  return s
}

// 그 날 공휴일 이름(없으면 null). 달력 표시용.
export function nameOf(date) {
  const c = readCache(date.slice(0, 4))
  return c?.names?.[date] || null
}
