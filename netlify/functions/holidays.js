// 공휴일 프록시 — 공공데이터포털 특일정보(getRestDeInfo)를 서버측에서 호출.
//  · serviceKey는 Netlify 환경변수(HOLIDAY_API_KEY, '일반 인증키 Decoding')로 숨김 → 클라이언트 노출 0
//  · CORS 헤더를 붙여 브라우저(PWA)에서 직접 호출 가능
//  · Cache-Control로 Netlify CDN이 하루 캐시 → data.go.kr 호출 최소화(대체공휴일도 공포되면 다음 갱신에 반영)
// 요청:  /.netlify/functions/holidays?year=2026
// 응답:  { year, dates:['2026-01-01',...], names:{'2026-01-01':'1월1일'} }  (isHoliday='Y'인 쉬는 날만)

const BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=86400, s-maxage=86400',
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  const key = process.env.HOLIDAY_API_KEY
  if (!key) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'HOLIDAY_API_KEY 미설정' }) }

  const year = String(event.queryStringParameters?.year || '').slice(0, 4)
  if (!/^\d{4}$/.test(year)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'year(YYYY) 필요' }) }

  try {
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const perMonth = await Promise.all(
      months.map(async (m) => {
        const qs = new URLSearchParams({
          serviceKey: key, // Decoding 키 → URLSearchParams가 알아서 인코딩(이중인코딩 방지)
          solYear: year,
          solMonth: String(m).padStart(2, '0'),
          numOfRows: '50',
          _type: 'json',
        })
        const r = await fetch(`${BASE}?${qs.toString()}`)
        if (!r.ok) return []
        const j = await r.json()
        let items = j?.response?.body?.items?.item
        if (!items) return []
        return Array.isArray(items) ? items : [items]
      }),
    )

    const dates = []
    const names = {}
    for (const it of perMonth.flat()) {
      if (it.isHoliday !== 'Y') continue
      const ld = String(it.locdate)
      const d = `${ld.slice(0, 4)}-${ld.slice(4, 6)}-${ld.slice(6, 8)}`
      if (!names[d]) dates.push(d)
      names[d] = it.dateName
    }
    dates.sort()
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ year: Number(year), dates, names }) }
  } catch (e) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: String(e) }) }
  }
}
