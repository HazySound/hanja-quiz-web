import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { loadHanja, resolveScope, hanjaByIds, readingText } from '../lib/hanja.js'
import { getGrade, getOnly } from '../lib/prefs.js'
import { Sheet, CheckDot } from '../components/Sheet.jsx'
import ScopeBuilder from '../components/ScopeBuilder.jsx'
import * as schedule from '../lib/schedule.js'
import * as holidays from '../lib/holidays.js'

// 학습 스케줄러
//  - 계획 있음 → 메인은 '오늘 분량' 화면(일일 학습/완료 체크). [📅 캘린더]로 캘린더 열기.
//  - 계획 없음 / 수정 → '캘린더' 화면에서 계획을 만들고 편집(기간·쉬는날·분량을 달력으로).
export default function Schedule() {
  const nav = useNavigate()
  const location = useLocation()
  const [all, setAll] = useState(null)
  const [sch, setSch] = useState(() => schedule.load())
  const [view, setView] = useState(() => (schedule.load() ? location.state?.view || 'today' : 'edit'))
  const [, setHv] = useState(0) // 공휴일 캐시 도착 시 재계산용
  useEffect(() => {
    loadHanja().then(setAll)
  }, [])
  // 계획이 있으면 해당 연도 공휴일을 항상 미리 받아 캐싱(빨간 표시는 늘, 제외 여부는 토글이 결정) → 도착하면 다시 그림.
  useEffect(() => {
    if (sch) holidays.prefetch(schedule.yearsOf(sch)).then(() => setHv((v) => v + 1))
  }, [sch])

  if (view === 'edit') {
    return (
      <CalendarEditor
        all={all}
        base={sch}
        onBack={() => (sch ? setView('calendar') : nav('/'))}
        onSaved={(s) => {
          setSch(s)
          setView('today')
        }}
        onRemove={() => {
          schedule.remove()
          setSch(null)
          nav('/')
        }}
      />
    )
  }
  if (view === 'calendar') {
    return <CalendarView all={all} sch={sch} initialSel={location.state?.sel} onBack={() => setView('today')} onEdit={() => setView('edit')} />
  }
  if (view === 'overdue') {
    return <Overdue all={all} sch={sch} refresh={() => setSch(schedule.load())} onBack={() => setView('today')} />
  }
  return <Today all={all} sch={sch} refresh={() => setSch(schedule.load())} onCalendar={() => setView('calendar')} onOverdue={() => setView('overdue')} nav={nav} />
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const KIND_LABEL = { all: '전체', chapter: '챕터', radical: '부수', strokes: '획수', list: '목록' }

// ===== 메인: 오늘 분량 =====
function Today({ all, sch, refresh, onCalendar, onOverdue, nav }) {
  const today = schedule.todayStr()
  const plan = schedule.buildPlan(sch, today)
  const { wrongSet, solvedSet } = schedule.wrongSets()
  const overdueSet = new Set(plan.overdue)
  const rows = all ? hanjaByIds(all, plan.displayIds) : []
  const pct = plan.total ? Math.round((plan.doneCount / plan.total) * 100) : 0
  const stripRef = useRef(null)
  const todayRef = useRef(null)
  useEffect(() => {
    const c = stripRef.current, t = todayRef.current
    if (c && t) c.scrollLeft += t.getBoundingClientRect().left - c.getBoundingClientRect().left - c.clientWidth / 2 + t.clientWidth / 2
  }, [])

  const [sheetH, setSheetH] = useState(null) // 개별 한자 상세 시트
  const [bulkAdded, setBulkAdded] = useState(null) // '수동 완료' 토글이 이번에 처리한 ids(되돌리기용)
  const total = plan.displayIds.length
  const hasQuota = total > 0
  const doneToday = total - plan.dueIds.length
  const allDone = hasQuota && plan.dueIds.length === 0

  // 일일학습 버튼: 2×2 고정. 완료기준 미선택=흐림(비활성), 선택했지만 대상없음(오답)=점선+없음(비활성).
  const cItems = sch.criteria?.items || []
  // 완료해도 덱/문제에서 빼지 않음(반복 학습 가능). 대상 = 오늘 분량 전체(완료 포함).
  const dayIds = plan.displayIds
  const wrongDue = plan.dueIds.filter((id) => wrongSet.has(id) && !solvedSet.has(id))
  const btns = [
    { m: 'flash', label: '🃏 암기', sel: cItems.includes('flash'), ids: dayIds, accent: false },
    { m: 'quiz', label: '📝 문제', sel: cItems.includes('quiz'), ids: dayIds, accent: true },
    { m: 'word', label: '🔤 단어', sel: cItems.includes('word'), ids: dayIds, accent: false },
    { m: 'wrong', label: '❌ 오답노트', sel: cItems.includes('wrong'), ids: wrongDue, accent: false, wrong: true },
  ]

  // 암기·단어 = 고정 순서(셔플 토글로 섞기). 문제·오답 = 'seen'(매번 랜덤 + 출제횟수 적은 것 우선).
  const launch = (mode, ids) => {
    if (mode === 'flash') {
      nav('/flashcards', { state: { scope: { kind: 'list', ids, order: 'asis', count: null }, title: '일일 학습', scheduleMark: true } })
    } else if (mode === 'word') {
      nav('/word-daily', { state: { ids, title: '일일 단어', scheduleMark: true } })
    } else {
      nav('/quiz', { state: { scope: { kind: 'list', ids, order: 'seen', count: null }, title: '일일 학습', scheduleMark: true, mode, noWord: true } })
    }
  }
  // 수동 완료 토글: off→남은 분량 전부 완료처리(눌림), on→이 버튼이 처리한 것만 정확히 해제(직전 상태로).
  const toggleAllComplete = () => {
    if (allDone) {
      const undo = bulkAdded || plan.displayIds.filter((id) => sch.studied?.[id])
      schedule.unmarkStudied(undo)
      setBulkAdded(null)
      refresh()
      return
    }
    const added = [...plan.dueIds]
    const unmet = added.filter((id) => !schedule.criteriaMet(sch, id, wrongSet, solvedSet))
    if (unmet.length && !confirm(`아직 학습 항목이 덜 끝난 한자가 ${unmet.length}자 있어요.\n그래도 완료로 표시할까요?`)) return
    schedule.markStudied(added, today)
    setBulkAdded(added)
    refresh()
  }
  // 개별 한자 완료 토글(체크 탭). 미완료 항목 있으면 알림 1회.
  const completeOne = (id) => {
    if (schedule.isDone(sch, id, wrongSet, solvedSet)) {
      if (sch.studied?.[id]) { schedule.toggleStudied(id, today); refresh() } // 수동 완료만 해제 가능
      return
    }
    if (!schedule.criteriaMet(sch, id, wrongSet, solvedSet) && !confirm('이 한자는 아직 안 끝낸 항목이 있어요.\n그래도 완료로 표시할까요?')) return
    schedule.markStudied([id], today)
    refresh()
  }
  // 미완료 항목 바로 채우기: 그 한자만 해당 모드로 학습(자동 기록).
  // 개별 한자 '바로 채우기' — 진행 중인 메인 세션을 건드리지 않게 fill 플래그(세션 저장/복원 안 함, 진도만 기록).
  const fill = (id, mode) => {
    if (mode === 'flash') nav('/flashcards', { state: { scope: { kind: 'list', ids: [id] }, title: '채우기', scheduleMark: true, fill: true } })
    else if (mode === 'word') nav('/word-daily', { state: { ids: [id], title: '단어 채우기', scheduleMark: true, fill: true } })
    else nav('/quiz', { state: { scope: { kind: 'list', ids: [id] }, title: '채우기', scheduleMark: true, fill: true, mode, noWord: true } })
  }

  // 분량(목록)이 없는 경우에만 안내문. 다 완료여도 분량 있으면 목록+토글을 유지한다.
  let empty = null
  if (!hasQuota) {
    if (!plan.started) empty = `시작 전이에요 · ${diffLabel(today, sch.start)}`
    else if (plan.ended) empty = '🎉 학습 기간을 모두 마쳤어요!'
    else if (!plan.isStudyDay) empty = plan.nextDay ? `오늘은 쉬는 날 · 다음 학습일 ${schedule.mdLabel(plan.nextDay)}(${schedule.weekdayLabel(plan.nextDay)})` : '오늘은 쉬는 날이에요'
    else empty = '오늘 배정된 한자가 없어요.'
  }

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => nav('/')} className="rounded-xl bg-card px-3.5 py-2 text-sm hover:bg-card-hover">◀</button>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">🗓️ {sch.name}</h1>
          <button onClick={onCalendar} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover">📅 캘린더</button>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card">
            <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-muted shrink-0 text-xs"><span className="text-gold font-bold">{plan.doneCount}</span>/{plan.total} · {diffLabel(today, schedule.effectiveEnd(sch))}</span>
        </div>
        {/* 날짜 띠 — 오늘 강조(헷갈리지 않게) */}
        {plan.perDay.length > 0 && (
          <div ref={stripRef} className="scroll-x mb-3 flex gap-1.5 pb-1">
            {plan.perDay.map((d) => {
              const isT = d.date === today
              const tone = isT ? 'bg-accent border-accent text-white' : d.status === 'done' ? 'bg-good/15 border-good/40 text-good' : d.status === 'missed' ? 'bg-bad/15 border-bad/40 text-bad' : 'bg-card border-line/40 text-muted'
              return (
                <div key={d.date} ref={isT ? todayRef : null} className={`flex w-12 shrink-0 flex-col items-center rounded-xl border px-1 py-1.5 ${tone}`}>
                  <span className="text-[11px] font-semibold">{schedule.mdLabel(d.date)}</span>
                  <span className="text-[10px] opacity-80">{schedule.weekdayLabel(d.date)}</span>
                  <span className="mt-0.5 text-xs font-bold">{d.done}/{d.total}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="screen-scroll">
        {empty ? (
          <div className="bg-good/10 border-good/30 rounded-2xl border p-6 text-center">
            <p className="text-good text-sm font-semibold">{empty}</p>
          </div>
        ) : (
          <>
            {/* 밀림 관리 진입 */}
            {plan.overdue.length > 0 && (
              <button onClick={onOverdue} className="bg-bad/10 border-bad/40 text-bad mb-3 flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold">
                <span>⚠️ 밀린 분량 {plan.overdue.length}자</span>
                <span className="ml-auto">정리하기 ›</span>
              </button>
            )}

            {/* 오늘 분량 + 실제 완료 진행(상태) */}
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-bold">오늘 분량 {total}자{plan.overdue.length > 0 && <span className="text-bad ml-1.5 text-sm font-semibold">밀림 {plan.overdue.length}</span>}</span>
              <span className="text-muted text-xs"><span className="text-good font-bold">{doneToday}</span>/{total} 완료</span>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-card">
              <div className="bg-good h-full rounded-full transition-all duration-300" style={{ width: total ? `${(doneToday / total) * 100}%` : '0%' }} />
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              {btns.map((b) => {
                const active = b.sel && b.ids.length > 0
                const selInactive = b.sel && !active // 선택했지만 대상 없음(오답 다 맞힘/없음)
                const cls = active
                  ? b.accent
                    ? 'bg-accent text-white hover:opacity-90'
                    : b.wrong
                      ? 'bg-bad/15 text-bad hover:bg-bad/25'
                      : 'bg-card text-white hover:bg-card-hover'
                  : selInactive
                    ? 'border border-dashed border-line text-muted cursor-default'
                    : 'bg-card/40 text-muted/50 cursor-not-allowed'
                return (
                  <button key={b.m} disabled={!active} onClick={() => launch(b.m, b.ids)} className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${cls}`}>
                    {b.label}
                    {b.wrong && active && <span> {b.ids.length}</span>}
                    {selInactive && <span className="text-muted/70 text-xs font-normal"> · 없음</span>}
                  </button>
                )
              })}
            </div>

            {/* 수동 완료 토글 — 기본 흰 아웃라인(미완), 누르면 초록+✓(완료), 다시 누르면 직전 상태로 */}
            <button
              onClick={toggleAllComplete}
              className={`mb-3 w-full rounded-xl border py-2.5 text-sm font-bold transition-colors ${
                allDone ? 'border-good bg-good/10 text-good' : 'border-white/60 text-white hover:bg-white/5'
              }`}
            >
              {allDone ? '✓ 오늘 분량 완료됨' : `오늘 분량 수동 완료${plan.dueIds.length ? ` (남은 ${plan.dueIds.length}자)` : ''}`}
            </button>

            <div className="flex flex-col gap-2">
              {rows.map((h) => {
                const on = schedule.isDone(sch, h.id, wrongSet, solvedSet)
                const its = schedule.itemStatus(sch, h.id, wrongSet, solvedSet)
                return (
                  <div key={h.id} className={`flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors ${on ? 'border-good/40' : 'border-transparent'}`}>
                    <button onClick={() => completeOne(h.id)} aria-label="완료 토글" className="-m-1 shrink-0 p-1"><CheckDot on={on} /></button>
                    <button onClick={() => setSheetH(h)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className={`hanja text-2xl transition-colors ${on ? 'text-muted/65' : 'text-white'}`}>{h.c}</span>
                      <span className="min-w-0 flex-1">
                        <span className="text-sm">
                          <span className={`transition-colors ${on ? 'text-muted/65 line-through' : 'text-white/85'}`}>{readingText(h)}</span>
                          {overdueSet.has(h.id) && !on && <span className="text-bad ml-2 text-xs font-semibold">밀림</span>}
                        </span>
                        {its.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {its.map((s) => (
                              <span key={s.k} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${s.met ? 'bg-good/15 text-good' : 'bg-card-hover text-muted'}`}>{s.met ? '✓ ' : ''}{s.label}</span>
                            ))}
                          </span>
                        )}
                      </span>
                      <span className="text-muted shrink-0 text-sm">›</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <HanjaSheet h={sheetH} sch={sch} wrongSet={wrongSet} solvedSet={solvedSet} onClose={() => setSheetH(null)} onFill={fill} onComplete={completeOne} />
    </motion.div>
  )
}

const MODE_LABEL = { flash: '🃏 암기', quiz: '📝 문제', word: '🔤 단어' }

// 개별 한자 시트: 항목별 진행 + 안 한 항목 바로 채우기 + 수동 완료 표시.
function HanjaSheet({ h, sch, wrongSet, solvedSet, onClose, onFill, onComplete }) {
  if (!h) return null
  const its = schedule.itemStatus(sch, h.id, wrongSet, solvedSet)
  const done = schedule.isDone(sch, h.id, wrongSet, solvedSet)
  const manual = !!sch.studied?.[h.id]
  const modes = [...new Set(its.filter((s) => !s.met).map((s) => (s.k === 'flash' ? 'flash' : s.k === 'word' ? 'word' : 'quiz')))]
  return (
    <Sheet open={!!h} onClose={onClose} title={`${h.c}  ${readingText(h)}`}>
      {its.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {its.map((s) => (
            <span key={s.k} className={`rounded-lg px-2 py-1 text-xs font-semibold ${s.met ? 'bg-good/15 text-good' : 'bg-card-hover text-muted'}`}>{s.met ? '✓ ' : ''}{s.label}</span>
          ))}
        </div>
      )}
      {!done && modes.length > 0 && (
        <>
          <div className="text-muted mb-1.5 text-sm">안 한 항목 바로 채우기</div>
          <div className="mb-3 flex gap-2">
            {modes.map((m) => (
              <button key={m} onClick={() => onFill(h.id, m)} className="flex-1 rounded-xl bg-card-hover py-2.5 text-sm font-bold hover:bg-card">{MODE_LABEL[m]}</button>
            ))}
          </div>
        </>
      )}
      {/* 완료 토글 — 같은 규칙(흰 아웃라인=미완 / 초록+✓=완료). 자동완료는 해제 불가(다시 누름 무효). */}
      <button
        onClick={() => onComplete(h.id)}
        className={`w-full rounded-xl border py-2.5 text-sm font-bold transition-colors ${done ? 'border-good bg-good/10 text-good' : 'border-white/60 text-white hover:bg-white/5'}`}
      >
        {done ? `✓ 완료됨${manual ? '' : ' (자동)'}` : '이 한자 완료로 표시'}
      </button>
    </Sheet>
  )
}

// ===== 캘린더(조회용): 날짜별 배정·완료·메모 한눈에 =====
function CalendarView({ all, sch, onBack, onEdit, initialSel }) {
  const nav = useNavigate()
  const today = schedule.todayStr()
  const { wrongSet, solvedSet } = schedule.wrongSets()
  const plan = schedule.buildPlan(sch, today)
  const assignMap = schedule.assignmentMap(sch)
  const effEnd = schedule.effectiveEnd(sch)
  const offSet = new Set(sch.offDays?.dates || [])
  const skipWeekend = !!sch.offDays?.weekends
  const isOff = (d) => (skipWeekend && schedule.isWeekend(d)) || offSet.has(d)
  const pct = plan.total ? Math.round((plan.doneCount / plan.total) * 100) : 0
  const done = (id) => schedule.isDone(sch, id, wrongSet, solvedSet)

  const [anchor, setAnchor] = useState(() => ({ y: Number((initialSel || today).slice(0, 4)), m: Number((initialSel || today).slice(5, 7)) }))
  const [sel, setSel] = useState(initialSel || today)
  const grid = schedule.monthGrid(anchor.y, anchor.m)
  const shift = (d) => setAnchor((a) => { let m = a.m + d, y = a.y; if (m < 1) { m = 12; y-- } if (m > 12) { m = 1; y++ } return { y, m } })
  const goToday = () => { setAnchor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }); setSel(today) }

  const cellStatus = (date, ids) => {
    if (!ids.length) return isOff(date) ? 'off' : 'none'
    if (date === today) return 'today'
    if (date < today) return ids.every(done) ? 'done' : 'missed'
    return 'future'
  }

  const selIds = assignMap.get(sel) || []
  const selRows = all ? hanjaByIds(all, selIds) : []
  const selDone = selIds.filter(done).length
  // 복습(완료한 한자만). 누적=전체 완료분, 날짜별=그 날 완료분. 스케줄 완료엔 영향 없음(scheduleMark X).
  const reviewAllIds = sch.ids.filter(done)
  const reviewDayIds = selIds.filter(done)
  // rkey: 'all'(누적) | 'date:YYYY-MM-DD'(날짜별) — 진도 저장 슬롯 구분
  const reviewGo = (mode, ids, rkey) => {
    if (!ids.length) return
    const back = { view: 'calendar', sel } // 복습 끝나고 뒤로가면 캘린더의 그 날짜로 복귀
    // 암기·단어=고정 순서(셔플로 섞기) / 문제=랜덤+덜 본 것 우선('seen')
    if (mode === 'flash') nav('/flashcards', { state: { scope: { kind: 'list', ids, order: 'asis', count: null }, title: '복습', back, reviewKey: rkey } })
    else if (mode === 'word') nav('/word-daily', { state: { ids, title: '단어 복습', back, reviewKey: rkey } })
    else nav('/quiz', { state: { scope: { kind: 'list', ids, order: 'seen', count: null }, title: '복습', back, noWord: true, reviewKey: rkey } })
  }
  const holName = holidays.nameOf(sel)
  const selOff = (isOff(sel) || (holName && !selIds.length)) && !selIds.length
  const memo = sch.memo?.[sel] || ''

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">
        <div className="mb-2 flex items-center gap-2">
          <button onClick={onBack} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover">◀</button>
          <button onClick={() => nav('/')} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover" aria-label="메인">🏠</button>
          <h1 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">🗓️ {sch.name}</h1>
          <button onClick={onEdit} className="flex shrink-0 items-center gap-1 rounded-xl border border-white/60 bg-card px-3 py-2 text-sm font-semibold text-white hover:bg-white/5">
            <span className="inline-block -scale-x-100 text-xs">✏️</span> 계획 수정
          </button>
        </div>
        <div className="mb-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card">
            <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-muted shrink-0 text-xs">{schedule.mdLabel(sch.start)}~{schedule.mdLabel(effEnd)} · <span className="text-gold font-bold">{plan.doneCount}</span>/{plan.total} · {diffLabel(today, effEnd)}</span>
        </div>
      </div>

      <div className="screen-scroll">
        {/* 누적 복습 — 첫날~오늘 완료한 한자 전체 */}
        <div className="mb-4 rounded-2xl bg-card p-4">
          <div className="mb-2 text-sm"><span className="font-bold">📚 누적 복습</span> <span className="text-muted">완료 {reviewAllIds.length}자</span></div>
          <ReviewButtons ids={reviewAllIds} rkey="all" onGo={reviewGo} />
        </div>

        <div className="mb-1 flex items-center justify-between">
          <button onClick={() => shift(-1)} className="rounded-lg px-3 py-1 text-lg hover:bg-card">‹</button>
          <button onClick={goToday} className="text-base font-bold">{schedule.ymLabel(anchor.y, anchor.m)}</button>
          <button onClick={() => shift(1)} className="rounded-lg px-3 py-1 text-lg hover:bg-card">›</button>
        </div>
        <div className="grid grid-cols-7">
          {WEEK.map((w, i) => (
            <div key={w} className={`pb-1 text-center text-[11px] font-semibold ${i === 0 ? 'text-bad/80' : i === 6 ? 'text-accent/80' : 'text-muted'}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map(({ date, inMonth }) => {
            const ids = assignMap.get(date) || []
            return <Cell key={date} date={date} inMonth={inMonth} selected={date === sel} isToday={date === today} status={cellStatus(date, ids)} count={ids.length} hasMemo={!!sch.memo?.[date]} holiday={!!holidays.nameOf(date)} onClick={() => setSel(date)} />
          })}
        </div>

        {/* 선택한 날 상세(조회) */}
        <div className="mt-4 rounded-2xl bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-bold">{schedule.mdLabel(sel)} <span className="text-muted text-sm font-normal">({schedule.weekdayLabel(sel)}{sel === today ? ' · 오늘' : ''})</span></span>
            {selOff ? <span className="text-muted text-xs">쉬는 날</span> : <span className="text-muted text-sm">배정 {selIds.length}자</span>}
          </div>
          {holName && <div className="text-bad mb-2 text-xs font-semibold">🔴 {holName} (공휴일)</div>}
          {!selOff && selIds.length > 0 && (
            <div className="mb-2 text-sm">
              <span className="text-good font-semibold">완료 {selDone}</span>
              {sel < today && selDone < selIds.length && <span className="text-bad ml-2 font-semibold">밀림 {selIds.length - selDone}</span>}
              {sel >= today && selDone < selIds.length && <span className="text-muted ml-2">남음 {selIds.length - selDone}</span>}
            </div>
          )}
          {memo && <div className="bg-card-hover mb-2 rounded-xl p-2.5 text-sm"><span className="text-muted">📝 </span>{memo}</div>}
          {selRows.length > 0 ? (
            <div className="screen-scroll flex max-h-56 flex-col gap-1.5">
              {selRows.map((h) => {
                const on = done(h.id)
                return (
                  <div key={h.id} className={`flex items-center gap-3 rounded-xl border bg-card-hover p-2.5 ${on ? 'border-good/40' : 'border-transparent'}`}>
                    <span className={`hanja text-xl ${on ? 'text-muted/65' : 'text-white'}`}>{h.c}</span>
                    <span className={`flex-1 text-sm ${on ? 'text-muted/65' : 'text-white/85'}`}>{readingText(h)}</span>
                    {on && <span className="text-good shrink-0 text-xs font-semibold">✓</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            !selOff && <p className="text-muted text-sm">배정된 한자가 없어요.</p>
          )}

          {/* 이 날 복습 — 그 날 완료한 한자만(완료 0이면 버튼 비활성) */}
          {selIds.length > 0 && (
            <div className="border-line/40 mt-3 border-t pt-3">
              <div className="text-muted mb-2 text-xs">📚 이 날 복습 · 완료 {reviewDayIds.length}자</div>
              <ReviewButtons ids={reviewDayIds} rkey={`date:${sel}`} onGo={reviewGo} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// 복습 버튼 3종(완료한 한자 대상). 비면 비활성.
function ReviewButtons({ ids, rkey, onGo }) {
  const dis = !ids.length
  return (
    <div className="flex gap-2">
      <button disabled={dis} onClick={() => onGo('flash', ids, rkey)} className="bg-card-hover hover:bg-card flex-1 rounded-lg py-2 text-xs font-bold disabled:opacity-40">🃏 암기</button>
      <button disabled={dis} onClick={() => onGo('quiz', ids, rkey)} className="bg-card-hover hover:bg-card flex-1 rounded-lg py-2 text-xs font-bold disabled:opacity-40">📝 문제</button>
      <button disabled={dis} onClick={() => onGo('word', ids, rkey)} className="bg-card-hover hover:bg-card flex-1 rounded-lg py-2 text-xs font-bold disabled:opacity-40">🔤 단어</button>
    </div>
  )
}

// ===== 캘린더: 계획 생성/수정 =====
const ITEMS = [
  { k: 'flash', label: '암기' },
  { k: 'quiz', label: '문제' },
  { k: 'wrong', label: '오답노트' },
  { k: 'word', label: '단어' },
]

function CalendarEditor({ all, base, onBack, onSaved, onRemove }) {
  const nav = useNavigate()
  const grade = getGrade()
  const only = getOnly()
  const today = schedule.todayStr()
  const editing = !!base

  const [name, setName] = useState(base?.name || '')
  const [scope, setScope] = useState(base?.scope || { kind: 'all', order: 'seq', count: null })
  const [start, setStart] = useState(base?.start || today)
  const [end, setEnd] = useState(base?.end || schedule.addDays(today, 13))
  const [includeWeekends, setIncludeWeekends] = useState(base ? !base.offDays?.weekends : false)
  const [excludeHolidays, setExcludeHolidays] = useState(base?.offDays?.holidays || false)
  const [offDates, setOffDates] = useState(base?.offDays?.dates || [])
  const [, setHv] = useState(0)
  const [memo, setMemo] = useState(base?.memo || {})
  const [items, setItems] = useState(base?.criteria?.items || ['flash', 'quiz'])
  const [quizReps, setQuizReps] = useState(base?.criteria?.quizReps || 1)
  const [wordReps, setWordReps] = useState(base?.criteria?.wordReps || 1)

  const [openScope, setOpenScope] = useState(!editing)
  const [openCrit, setOpenCrit] = useState(false)
  const [anchor, setAnchor] = useState(() => ({ y: Number((base?.start || today).slice(0, 4)), m: Number((base?.start || today).slice(5, 7)) }))
  const [sel, setSel] = useState(null)

  const resolved = all ? resolveScope(all, { grade, only, ...scope }) : []
  const ids = resolved.map((h) => h.id)
  // 미리보기용 임시 스케줄(분배 계산).
  const draft = { ids, start, end, offDays: { weekends: !includeWeekends, dates: offDates, holidays: excludeHolidays } }
  // 해당 연도 공휴일 prefetch(항상) → 도착 시 미리보기 재계산. 빨간 표시는 늘, 제외는 토글이 결정.
  useEffect(() => {
    holidays.prefetch(schedule.yearsOf({ start, end })).then(() => setHv((v) => v + 1))
  }, [start, end])
  const previewMap = schedule.assignmentMap(draft)
  const days = schedule.studyDays(draft)
  const N = ids.length
  const D = days.length
  const perDay = D ? Math.ceil(N / D) : 0
  const valid = N > 0 && D > 0 && start <= end && items.length > 0

  const grid = schedule.monthGrid(anchor.y, anchor.m)
  const offSet = new Set(offDates)
  const skipWeekend = !includeWeekends
  const isStudy = (date) => date >= start && date <= end && !(skipWeekend && schedule.isWeekend(date)) && !offSet.has(date)
  const shift = (d) => setAnchor((a) => {
    let m = a.m + d, y = a.y
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    return { y, m }
  })

  const toggleItem = (k) => setItems((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const toggleOff = (date) => setOffDates((s) => (s.includes(date) ? s.filter((x) => x !== date) : [...s, date].sort()))
  const setDayMemo = (date, text) => setMemo((m) => { const n = { ...m }; if (text && text.trim()) n[date] = text; else delete n[date]; return n })

  const save = () => {
    if (!valid) return
    const obj = {
      id: base?.id || 'sch_' + Date.now(),
      name: name.trim() || '한자 학습',
      scope,
      ids,
      start,
      end,
      offDays: { weekends: !includeWeekends, dates: offDates, holidays: excludeHolidays },
      criteria: { items, quizReps, wordReps },
      memo,
      studied: base?.studied || {},
      prog: base?.prog || {},
      assigned: base?.assigned || {},
      createdAt: base?.createdAt || today,
    }
    schedule.commit(obj)
    onSaved(obj)
  }

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={onBack} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover">◀</button>
          <button onClick={() => nav('/')} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover" aria-label="메인">🏠</button>
          <h1 className="flex-1 text-lg font-bold tracking-tight">{editing ? '계획 수정' : '학습 계획 만들기'}</h1>
        </div>
      </div>

      <div className="screen-scroll">
        {/* 이름 */}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="계획 이름 (예: 중간고사 5급)" autoComplete="off" className="mb-3 w-full rounded-xl border-2 border-transparent bg-card p-2.5 text-sm outline-none placeholder:text-muted focus:border-accent" />

        {/* 범위(접이식) */}
        <Accordion open={openScope} onToggle={() => setOpenScope((v) => !v)} label="범위" value={`${KIND_LABEL[scope.kind] || '전체'} · ${N}자`}>
          {!all ? <p className="text-muted text-sm">불러오는 중…</p> : <ScopeBuilder all={all} grade={grade} only={only} scope={scope} onChange={setScope} />}
        </Accordion>

        {/* 완료 기준(접이식) */}
        <Accordion open={openCrit} onToggle={() => setOpenCrit((v) => !v)} label="완료 기준" value={items.map((k) => ITEMS.find((x) => x.k === k)?.label).join('·') || '—'}>
          <div className="mb-2 flex flex-wrap gap-2">
            {ITEMS.map((it) => (
              <button key={it.k} onClick={() => toggleItem(it.k)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${items.includes(it.k) ? 'bg-accent text-white' : 'bg-card-hover text-muted'}`}>{it.label}</button>
            ))}
          </div>
          {(items.includes('quiz') || items.includes('word')) && (
            <div className="flex flex-col gap-2 rounded-xl bg-card-hover p-3 text-sm">
              {items.includes('quiz') && <RepRow label="문제 반복" value={quizReps} onChange={setQuizReps} />}
              {items.includes('word') && <RepRow label="단어 반복" value={wordReps} onChange={setWordReps} />}
            </div>
          )}
          <p className="text-muted mt-2 text-xs">고른 항목을 모두 해야 '학습 완료'. 오답노트는 오답에 든 한자만·맞힘 떠야 완료.</p>
        </Accordion>

        {/* 기간 + 주말 */}
        <div className="mb-3 mt-3 flex items-center gap-2 text-sm">
          <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} className="flex-1 rounded-xl border-2 border-transparent bg-card p-2.5 outline-none focus:border-accent" />
          <span className="text-muted">~</span>
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="flex-1 rounded-xl border-2 border-transparent bg-card p-2.5 outline-none focus:border-accent" />
        </div>
        <label className="flex items-center justify-between rounded-xl bg-card px-4 py-2.5 text-sm">
          <span>주말도 학습일에 포함</span>
          <Switch on={includeWeekends} onClick={() => setIncludeWeekends((v) => !v)} />
        </label>
        <label className="mb-4 mt-2 flex items-center justify-between rounded-xl bg-card px-4 py-2.5 text-sm">
          <span>공휴일 자동 제외 <span className="text-muted text-xs">(대체공휴일 포함)</span></span>
          <Switch on={excludeHolidays} onClick={() => setExcludeHolidays((v) => !v)} />
        </label>

        {/* 달력 — 분배 미리보기 + 날짜 탭하면 아래에서 쉬는날/메모 */}
        <div className="mb-1 flex items-center justify-between">
          <button onClick={() => shift(-1)} className="rounded-lg px-3 py-1 text-lg hover:bg-card">‹</button>
          <span className="text-base font-bold">{schedule.ymLabel(anchor.y, anchor.m)}</span>
          <button onClick={() => shift(1)} className="rounded-lg px-3 py-1 text-lg hover:bg-card">›</button>
        </div>
        <div className="grid grid-cols-7">
          {WEEK.map((w, i) => (
            <div key={w} className={`pb-1 text-center text-[11px] font-semibold ${i === 0 ? 'text-bad/80' : i === 6 ? 'text-accent/80' : 'text-muted'}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map(({ date, inMonth }) => {
            const cnt = previewMap.get(date)?.length || 0
            const study = isStudy(date)
            const status = date < start || date > end ? 'none' : !study ? 'off' : date === today ? 'today' : 'future'
            return <Cell key={date} date={date} inMonth={inMonth} selected={date === sel} isToday={date === today} status={status} count={cnt} hasMemo={!!memo[date]} holiday={!!holidays.nameOf(date)} onClick={() => setSel(date)} />
          })}
        </div>

        {/* 선택한 날: 쉬는날 토글 + 메모 (생성 단계라 로컬 반영) */}
        {sel && <EditDay date={sel} start={start} end={end} count={previewMap.get(sel)?.length || 0} skipWeekend={skipWeekend} isOff={offSet.has(sel)} holName={holidays.nameOf(sel)} memo={memo[sel] || ''} onToggleOff={() => toggleOff(sel)} onMemo={(t) => setDayMemo(sel, t)} />}

        {/* 요약 */}
        <div className="mt-4 rounded-2xl bg-card p-4 text-sm">
          {valid ? (
            <p>총 <span className="text-gold font-bold">{N}자</span> · 학습일 <span className="font-bold">{D}일</span> · 하루 약 <span className="text-accent font-bold">{perDay}자</span></p>
          ) : (
            <p className="text-muted">{N === 0 ? '범위에 한자가 없어요.' : D === 0 ? '학습일이 없어요. 기간·주말·쉬는날을 확인하세요.' : items.length === 0 ? '완료 기준을 1개 이상 골라주세요.' : '기간을 확인하세요.'}</p>
          )}
        </div>

        {editing && (
          <button onClick={() => { if (confirm('학습 계획을 삭제할까요? 진도 기록도 함께 사라져요.')) onRemove() }} className="text-bad bg-bad/10 mt-3 w-full rounded-xl py-2.5 text-sm font-semibold">계획 삭제</button>
        )}
      </div>

      <div className="shrink-0 pt-3">
        <button onClick={save} disabled={!valid} className="w-full rounded-2xl bg-accent py-4 font-bold text-white border border-accent/40 hover:opacity-90 disabled:opacity-50">{editing ? '저장' : '계획 만들기'}</button>
      </div>
    </motion.div>
  )
}

// 달력 한 칸: 날짜 + 분량 칩.
function Cell({ date, inMonth, selected, isToday, status, count, hasMemo, holiday, onClick }) {
  const dnum = Number(date.slice(8, 10))
  const wd = schedule.weekdayOf(date)
  const chip =
    status === 'done' ? 'bg-good/20 text-good'
      : status === 'missed' ? 'bg-bad/20 text-bad'
        : status === 'today' ? 'bg-accent text-white'
          : 'bg-card-hover text-muted'
  const showChip = status !== 'none' && status !== 'off' && count > 0
  return (
    <button onClick={onClick} className={`flex min-h-[56px] flex-col items-center rounded-lg border px-0.5 pb-1 pt-1 ${selected ? 'border-accent bg-card' : 'border-transparent'} ${inMonth ? '' : 'opacity-30'}`}>
      <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${isToday ? 'bg-accent text-white' : holiday ? 'text-bad' : wd === 0 ? 'text-bad/90' : ''}`}>{dnum}</span>
      <div className="mt-0.5 flex w-full flex-col items-center gap-0.5">
        {showChip && <span className={`w-full truncate rounded px-1 text-center text-[10px] font-semibold leading-tight ${chip}`}>{count}자</span>}
        <div className="flex items-center gap-0.5">
          {holiday && <span className="h-1 w-1 rounded-full bg-bad" />}
          {hasMemo && <span className="h-1 w-1 rounded-full bg-gold" />}
        </div>
      </div>
    </button>
  )
}

// 캘린더에서 선택한 날 편집(쉬는날/메모) — 생성 단계 로컬 상태.
function EditDay({ date, start, end, count, skipWeekend, isOff, holName, memo, onToggleOff, onMemo }) {
  const inRange = date >= start && date <= end
  const weekendOff = skipWeekend && schedule.isWeekend(date)
  const isHol = !!holName && count === 0
  return (
    <div className="mt-3 rounded-2xl bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold">{schedule.mdLabel(date)} <span className="text-muted text-sm font-normal">({schedule.weekdayLabel(date)})</span></span>
        {inRange && !weekendOff && !isHol && (
          <button onClick={onToggleOff} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${isOff ? 'bg-accent text-white' : 'bg-card-hover text-muted'}`}>{isOff ? '학습일로' : '쉬는 날로'}</button>
        )}
      </div>
      {holName && <div className="text-bad mb-2 text-xs font-semibold">🔴 {holName} (공휴일)</div>}
      <p className="text-muted mb-2 text-sm">{!inRange ? '학습 기간 밖' : isHol ? '공휴일 (쉬는 날)' : weekendOff ? '주말 (쉬는 날)' : isOff ? '쉬는 날 — 배정 없음' : `배정 ${count}자`}</p>
      {inRange && (
        <textarea value={memo} onChange={(e) => onMemo(e.target.value)} rows={2} placeholder="📝 이 날 메모" className="w-full resize-none rounded-xl border-2 border-transparent bg-card-hover p-2.5 text-sm outline-none placeholder:text-muted focus:border-accent" />
      )}
    </div>
  )
}

function Accordion({ open, onToggle, label, value, children }) {
  return (
    <div className="mb-3 overflow-hidden rounded-xl bg-card">
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-card-hover">
        <span className="text-muted">{label}</span>
        <span className="ml-auto font-semibold">{value}</span>
        <span className="text-muted">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="border-line/60 border-t px-4 py-3">{children}</div>}
    </div>
  )
}

function RepRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(Math.max(1, value - 1))} className="h-7 w-7 rounded-lg bg-card text-lg leading-none">−</button>
        <span className="w-8 text-center font-semibold">{value}회</span>
        <button onClick={() => onChange(Math.min(9, value + 1))} className="h-7 w-7 rounded-lg bg-card text-lg leading-none">＋</button>
      </div>
    </div>
  )
}

function Switch({ on, onClick }) {
  return (
    <button onClick={onClick} className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-card-hover'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

// 앵커에서 연속 N개의 날짜. includeOff=false면 주말/휴일을 건너뛰고 '학습일' 기준으로 N개.
function consecutiveDates(anchor, runLen, includeOff, isOff) {
  if (!anchor) return []
  const out = []
  let cur = anchor
  let guard = 0
  while (out.length < runLen && guard < 800) {
    guard++
    if (includeOff || !isOff(cur)) out.push(cur)
    cur = schedule.addDays(cur, 1)
  }
  return out
}

// ===== 밀림 관리 =====
function Overdue({ all, sch, refresh, onBack }) {
  const nav = useNavigate()
  const today = schedule.todayStr()
  const plan = schedule.buildPlan(sch, today)
  const overdueIds = plan.overdue
  const rows = all ? hanjaByIds(all, overdueIds) : []
  const assignMap = schedule.assignmentMap(sch)
  const offSet = new Set(sch.offDays?.dates || [])
  const skipWeekend = !!sch.offDays?.weekends
  const isOff = (d) => (skipWeekend && schedule.isWeekend(d)) || offSet.has(d)

  // 한자 선택
  const [sel, setSel] = useState(() => new Set(overdueIds))
  const [rangeMode, setRangeMode] = useState(false)
  const [rangeAnchor, setRangeAnchor] = useState(null)
  // 날짜: 앵커 + 연속일수 + 주말/휴일 포함 → 선택 날짜는 '파생'(탭 취소·일수 변경이 즉시 반영)
  const [dateAnchor, setDateAnchor] = useState(null)
  const [runLen, setRunLen] = useState(1)
  const [includeOff, setIncludeOff] = useState(false)
  const [anchor, setAnchor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }))
  const grid = schedule.monthGrid(anchor.y, anchor.m)
  const shift = (d) => setAnchor((a) => { let m = a.m + d, y = a.y; if (m < 1) { m = 12; y-- } if (m > 12) { m = 1; y++ } return { y, m } })

  const dates = consecutiveDates(dateAnchor, runLen, includeOff, isOff)
  const pickedSet = new Set(dates)

  const allSel = sel.size === overdueIds.length && overdueIds.length > 0
  const toggleAllH = () => setSel(allSel ? new Set() : new Set(overdueIds))
  const tapHanja = (id) => {
    if (rangeMode) {
      if (!rangeAnchor) { setRangeAnchor(id); return }
      const a = overdueIds.indexOf(rangeAnchor)
      const b = overdueIds.indexOf(id)
      const [lo, hi] = a <= b ? [a, b] : [b, a]
      setSel((s) => { const n = new Set(s); for (let k = lo; k <= hi; k++) n.add(overdueIds[k]); return n })
      setRangeAnchor(null)
      setRangeMode(false)
    } else {
      setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
    }
  }
  // 날짜 탭: 선택 범위 안의 날을 다시 누르면 전체 해제, 아니면 그 날을 새 앵커로.
  const tapDate = (date) => {
    if (date < today) return
    if (pickedSet.has(date)) setDateAnchor(null)
    else setDateAnchor(date)
  }

  const canApply = sel.size > 0 && dates.length > 0
  const apply = () => {
    if (!canApply) return
    const ids = overdueIds.filter((id) => sel.has(id)) // sch.ids 순서 유지
    const idToDate = {}
    if (dates.length === 1) ids.forEach((id) => (idToDate[id] = dates[0]))
    else schedule.autoDistribute(ids, dates).forEach((d) => d.ids.forEach((id) => (idToDate[id] = d.date)))
    schedule.reassign(idToDate)
    refresh()
    onBack()
  }
  const auto = () => {
    if (!confirm('미완료 분량을 오늘부터 다시 깔고, 모자라면 목표일을 뒤로 늘립니다. (하루 분량 유지)\n진행할까요?')) return
    const s = schedule.autoPostpone(today)
    refresh()
    onBack()
    if (s) {
      const ee = schedule.effectiveEnd(s)
      alert(`자동으로 미뤘어요.\n새 종료일: ${schedule.mdLabel(ee)} (${diffLabel(today, ee)})`)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={onBack} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover">◀</button>
          <button onClick={() => nav('/')} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover" aria-label="메인">🏠</button>
          <h1 className="flex-1 text-lg font-bold tracking-tight">밀린 분량 정리</h1>
        </div>
      </div>

      <div className="screen-scroll">
        <p className="text-bad mb-3 text-sm font-semibold">밀린 한자 {overdueIds.length}자</p>

        {/* 1) 자동 미루기 */}
        <button onClick={auto} className="border-accent/50 bg-accent/10 hover:bg-accent/15 mb-1 flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm">
          <span className="text-lg">⚡</span>
          <span><span className="font-bold">자동으로 미루기</span><span className="text-muted block text-xs">밀린 것 전부, 하루 분량 유지하며 목표일을 뒤로</span></span>
        </button>

        <div className="text-muted my-3 text-center text-xs">— 또는 직접 배치 —</div>

        {/* 2) 옮길 한자 선택(기본 전체) + 범위 선택 */}
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-sm font-semibold">옮길 한자 <span className="text-muted">{sel.size}/{overdueIds.length}</span></span>
          <button onClick={() => { setRangeMode((v) => !v); setRangeAnchor(null) }} className={`ml-auto rounded-lg px-3 py-1 text-xs font-semibold ${rangeMode ? 'bg-accent text-white' : 'text-muted bg-card hover:bg-card-hover'}`}>
            {rangeMode ? (rangeAnchor ? '끝 한자 탭' : '시작 한자 탭') : '범위 선택'}
          </button>
          <button onClick={toggleAllH} className="text-muted rounded-lg bg-card px-3 py-1 text-xs hover:bg-card-hover">{allSel ? '전체 해제' : '전체 선택'}</button>
        </div>
        <div className="screen-scroll mb-4 flex max-h-40 flex-col gap-1.5">
          {rows.map((h) => (
            <button key={h.id} onClick={() => tapHanja(h.id)} className={`flex items-center gap-3 rounded-xl border bg-card p-2.5 text-left ${rangeMode && rangeAnchor === h.id ? 'border-accent' : 'border-transparent'}`}>
              <CheckDot on={sel.has(h.id)} />
              <span className="hanja text-xl">{h.c}</span>
              <span className="text-muted flex-1 text-sm">{readingText(h)}</span>
            </button>
          ))}
        </div>

        {/* 3) 날짜 고르기: 앵커 + 연속 N일 + 주말/휴일 포함 */}
        <div className="mb-1.5 flex items-center gap-2">
          <span className="shrink-0 text-sm font-semibold">넣을 날짜{dates.length > 0 && <span className="text-accent"> {dates.length}일</span>}</span>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <span className="text-muted text-xs">연속</span>
            <button onClick={() => setRunLen((v) => Math.max(1, v - 1))} className="h-6 w-6 shrink-0 rounded-lg bg-card text-base leading-none">−</button>
            <span className="min-w-[2.6rem] text-center text-sm font-semibold tabular-nums">{runLen}일</span>
            <button onClick={() => setRunLen((v) => Math.min(60, v + 1))} className="h-6 w-6 shrink-0 rounded-lg bg-card text-base leading-none">＋</button>
          </div>
        </div>
        <button onClick={() => setIncludeOff((v) => !v)} className={`mb-2 rounded-lg px-3 py-1 text-xs font-semibold ${includeOff ? 'bg-accent text-white' : 'text-muted bg-card hover:bg-card-hover'}`}>
          연속 시 주말·휴일 {includeOff ? '포함' : '제외'}
        </button>

        <div className="mb-1 flex items-center justify-between">
          <button onClick={() => shift(-1)} className="rounded-lg px-3 py-1 text-lg hover:bg-card">‹</button>
          <span className="text-sm font-bold">{schedule.ymLabel(anchor.y, anchor.m)}</span>
          <button onClick={() => shift(1)} className="rounded-lg px-3 py-1 text-lg hover:bg-card">›</button>
        </div>
        <div className="grid grid-cols-7">
          {WEEK.map((w, i) => (
            <div key={w} className={`pb-1 text-center text-[11px] font-semibold ${i === 0 ? 'text-bad/80' : i === 6 ? 'text-accent/80' : 'text-muted'}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map(({ date, inMonth }) => {
            const cnt = assignMap.get(date)?.length || 0
            const status = date < today ? 'none' : date === today ? 'today' : 'future'
            return <Cell key={date} date={date} inMonth={inMonth} selected={pickedSet.has(date)} isToday={date === today} status={status} count={cnt} hasMemo={!!sch.memo?.[date]} holiday={!!holidays.nameOf(date)} onClick={() => tapDate(date)} />
          })}
        </div>
        <p className="text-muted mt-2 text-xs">날짜를 탭해 시작점을 잡고 ‘연속 N일’로 길이를 정해요. 선택된 날을 다시 탭하면 해제. 셀의 ‘N자’는 그날 이미 잡힌 분량.</p>
      </div>

      <div className="shrink-0 pt-3">
        <button onClick={apply} disabled={!canApply} className="w-full rounded-2xl bg-accent py-4 font-bold text-white border border-accent/40 hover:opacity-90 disabled:opacity-50">
          {canApply ? `${sel.size}자 → ${dates.length === 1 ? `${schedule.mdLabel(dates[0])}에 넣기` : `${dates.length}일에 나눠 넣기`}` : '한자와 날짜를 골라주세요'}
        </button>
      </div>
    </motion.div>
  )
}

function diffLabel(today, target) {
  const n = schedule.diffDays(today, target)
  if (n > 0) return `D-${n}`
  if (n === 0) return 'D-day'
  return `${-n}일 지남`
}
