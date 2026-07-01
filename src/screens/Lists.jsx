import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { loadHanja, hanjaByIds, readingText } from '../lib/hanja.js'
import * as progress from '../lib/progress.js'
import { Sheet, Row, CheckDot } from '../components/Sheet.jsx'

// 내 목록: 한자 오답 노트 / 즐겨찾기. 암기·문제로 복습 + 선택모드 다중선택(일괄 빼기·다른 목록에 추가).
const LISTS = [
  { key: 'wrong', icon: '❌', title: '오답 노트', desc: '문제 틀린 한자' },
  { key: 'fav', icon: '⭐', title: '즐겨찾기', desc: '담아둔 한자' },
]

export default function Lists() {
  const nav = useNavigate()
  const { view } = useParams() // undefined=홈 | 'wrong' | 'fav'
  const [all, setAll] = useState(null)
  const [selMode, setSelMode] = useState(false)
  const [sel, setSel] = useState(() => new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [, setVer] = useState(0)
  const refresh = () => setVer((v) => v + 1)
  useEffect(() => {
    loadHanja().then(setAll)
  }, [])
  useEffect(() => {
    setSelMode(false)
    setSel(new Set())
  }, [view]) // 목록 바뀌면 선택 초기화

  // view: 'wrong' | 'fav' | 'c:<커스텀목록 이름>'
  const isCustom = !!view && view.startsWith('c:')
  const customName = isCustom ? view.slice(2) : null
  const idsOf = (key) => (key === 'wrong' ? progress.wrongIds() : key === 'fav' ? progress.favoriteIds() : progress.customIds(key.slice(2)))

  // ----- 홈 -----
  if (!view) {
    const customs = progress.customNames()
    return (
      <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="screen-scroll">
        <button onClick={() => nav('/')} className="mb-3 rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover">
          ◀ 뒤로
        </button>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">📚 내 목록</h1>
        <p className="text-muted mb-5 text-sm">틀린 한자·즐겨찾기를 모아 복습해요.</p>
        <div className="flex flex-col gap-3">
          {LISTS.map((l) => (
            <button
              key={l.key}
              onClick={() => nav(`/lists/${l.key}`)}
              className="flex items-center gap-3.5 rounded-2xl bg-card p-4 text-left transition-colors hover:bg-card-hover"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-xl">{l.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{l.title}</span>
                <span className="text-muted mt-0.5 block text-sm">
                  {l.desc} · {idsOf(l.key).length}개
                </span>
              </span>
              <span className="text-muted">›</span>
            </button>
          ))}
          {customs.map((nm) => (
            <button
              key={nm}
              onClick={() => nav('/lists/' + encodeURIComponent('c:' + nm))}
              className="flex items-center gap-3.5 rounded-2xl bg-card p-4 text-left transition-colors hover:bg-card-hover"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-xl">📑</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{nm}</span>
                <span className="text-muted mt-0.5 block text-sm">내가 만든 목록 · {progress.customIds(nm).length}개</span>
              </span>
              <span className="text-muted">›</span>
            </button>
          ))}
        </div>
        <p className="text-muted mt-4 text-xs">문제·암기에서 ☆ 버튼으로 즐겨찾기·내 목록에 담을 수 있어요.</p>
      </motion.div>
    )
  }

  // ----- 목록 보기 -----
  const meta = LISTS.find((l) => l.key === view) || (isCustom ? { key: view, icon: '📑', title: customName, custom: true } : null)
  if (!meta) {
    nav('/lists', { replace: true })
    return null
  }
  const ids = idsOf(view)
  const items = all ? hanjaByIds(all, ids) : []
  const cancelSel = () => {
    setSelMode(false)
    setSel(new Set())
  }
  const removeOne = (h) => {
    if (!confirm(`'${h.c} (${readingText(h)})' 을(를) ${meta.title}에서 뺄까요?`)) return
    if (view === 'wrong') progress.removeWrong(h.id)
    else if (isCustom) progress.removeCustom(h.id, customName)
    else progress.toggleFavorite(h.id)
    refresh()
  }
  const study = (mode) =>
    nav(mode === 'flash' ? '/flashcards' : '/quiz', {
      state: { scope: { kind: 'list', ids, order: 'seen', count: null }, title: meta.title },
    })
  const solvedSet = view === 'wrong' ? new Set(progress.wrongSolvedIds()) : new Set()
  const solvedIds = items.filter((h) => solvedSet.has(h.id)).map((h) => h.id)
  const allSolvedSel = solvedIds.length > 0 && solvedIds.every((id) => sel.has(id))
  // 다시 맞힌 것들 토글: 모두 선택돼 있으면 전부 해제, 아니면 전부 선택.
  const toggleSolved = () =>
    setSel((s) => {
      const all = solvedIds.every((id) => s.has(id))
      const n = new Set(s)
      solvedIds.forEach((id) => (all ? n.delete(id) : n.add(id)))
      return n
    })

  // 선택모드
  const toggleSel = (id) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allSelected = ids.length > 0 && sel.size === ids.length
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(ids))
  const bulkRemove = () => {
    if (!sel.size) return
    if (!confirm(`선택한 ${sel.size}개를 ${meta.title}에서 뺄까요?`)) return
    sel.forEach((id) => (view === 'wrong' ? progress.removeWrong(id) : isCustom ? progress.removeCustom(id, customName) : progress.toggleFavorite(id)))
    cancelSel()
    refresh()
  }
  const deleteList = () => {
    if (!confirm(`'${customName}' 목록을 삭제할까요? (담긴 한자 ${ids.length}개는 한자 자체엔 영향 없어요)`)) return
    progress.customDelete(customName)
    nav('/lists')
  }

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => nav('/lists')} className="rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover">
            ◀ 내 목록
          </button>
          <button onClick={() => nav('/')} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover" aria-label="메인">
            🏠
          </button>
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">
          {meta.icon} {meta.title}
        </h1>

        {selMode ? (
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={cancelSel} className="rounded-lg bg-card-hover px-3 py-1.5 text-sm">취소</button>
              <button onClick={toggleAll} className="rounded-lg bg-card-hover px-3 py-1.5 text-sm">
                {allSelected ? '전체 해제' : '전체 선택'}
              </button>
              <span className="text-muted text-sm">{sel.size}개</span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setAddOpen(true)} disabled={!sel.size} className="rounded-lg bg-card px-3 py-1.5 text-sm font-semibold hover:bg-card-hover disabled:opacity-40">
                  목록에 추가
                </button>
                <button onClick={bulkRemove} disabled={!sel.size} className="text-bad bg-bad/15 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
                  빼기
                </button>
              </div>
            </div>
            {view === 'wrong' && solvedIds.length > 0 && (
              <button
                onClick={toggleSolved}
                className={`mt-2 w-full rounded-xl border py-2.5 text-sm font-bold text-white ${
                  allSolvedSel ? 'bg-good/15 border-good/40 hover:bg-good/25' : 'border-white/40 hover:bg-white/5'
                }`}
              >
                ✓ 다시 맞힌 {solvedIds.length}개 {allSolvedSel ? '선택 해제' : '선택'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-2 flex gap-2">
              <button onClick={() => study('flash')} disabled={!ids.length} className="flex-1 rounded-xl bg-card py-2.5 text-sm font-bold hover:bg-card-hover disabled:opacity-40">
                🃏 암기
              </button>
              <button onClick={() => study('quiz')} disabled={!ids.length} className="bg-accent flex-1 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40">
                📝 문제풀기
              </button>
            </div>
            <p className="text-muted mb-2 text-sm">{ids.length}개</p>
            {ids.length > 0 && (
              <button onClick={() => setSelMode(true)} className="bg-accent/15 border border-accent/40 hover:bg-accent/25 mb-2 w-full rounded-xl py-2.5 text-base font-bold text-white">
                ☑️ 선택
              </button>
            )}
            {isCustom && (
              <button onClick={deleteList} className="text-muted mb-4 text-xs underline-offset-2 hover:underline">목록 삭제</button>
            )}
          </>
        )}
      </div>
      <div className="screen-scroll">
        {!ids.length ? (
          <p className="text-muted text-sm">
            {view === 'wrong' ? '아직 틀린 한자가 없어요.' : '아직 즐겨찾기한 한자가 없어요.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((h) =>
              selMode ? (
                <button key={h.id} onClick={() => toggleSel(h.id)} className="flex items-center gap-3 rounded-xl bg-card p-3 text-left">
                  <CheckDot on={sel.has(h.id)} />
                  <span className="hanja text-2xl">{h.c}</span>
                  <span className="flex-1 text-sm">
                    <span className="text-muted">{readingText(h)}</span>
                    {solvedSet.has(h.id) && <span className="text-good ml-2 text-xs font-semibold">✓ 맞힘</span>}
                  </span>
                </button>
              ) : (
                <div key={h.id} className="flex items-center gap-3 rounded-xl bg-card p-3">
                  <span className="hanja text-2xl">{h.c}</span>
                  <span className="flex-1 text-sm">
                    <span className="text-muted">{readingText(h)}</span>
                    {solvedSet.has(h.id) && <span className="text-good ml-2 text-xs font-semibold">✓ 맞힘</span>}
                  </span>
                  <button onClick={() => removeOne(h)} className="text-muted shrink-0 rounded-lg bg-card-hover px-3 py-1.5 text-sm">
                    빼기
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <HanjaAddSheet open={addOpen} view={view} ids={[...sel]} onClose={() => setAddOpen(false)} onAdded={() => { cancelSel(); refresh() }} />
    </motion.div>
  )
}

// 선택한 한자들을 다른 목록(오답·즐겨찾기·커스텀)에 추가하거나 새 목록으로. 이미 (전부) 들어있는 목록은 후보 제외.
function HanjaAddSheet({ open, view, ids, onClose, onAdded }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const customs = progress.customNames().map((nm) => ({
    key: 'c:' + nm,
    label: '📑 ' + nm,
    set: new Set(progress.customIds(nm)),
    add: (id) => progress.addCustom(id, nm),
  }))
  const cands = [
    { key: 'wrong', label: '❌ 오답 노트', set: new Set(progress.wrongIds()), add: progress.addWrong },
    { key: 'fav', label: '⭐ 즐겨찾기', set: new Set(progress.favoriteIds()), add: progress.addFavorite },
    ...customs,
  ].filter((c) => c.key !== view && ids.some((id) => !c.set.has(id)))
  const addTo = (c) => {
    ids.forEach((id) => c.add(id))
    onAdded()
    onClose()
  }
  const createAndAdd = () => {
    const nm = newName.trim()
    if (!nm) return
    progress.customCreate(nm)
    ids.forEach((id) => progress.addCustom(id, nm))
    setNewName('')
    setAdding(false)
    onAdded()
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={`${ids.length}개를 어디에 추가할까요?`}>
      <div className="flex flex-col gap-2">
        {cands.map((c) => (
          <Row key={c.key} onClick={() => addTo(c)}>{c.label}</Row>
        ))}
        {!adding ? (
          <button onClick={() => setAdding(true)} className="text-accent rounded-xl bg-card-hover px-4 py-3 text-left text-sm font-semibold">
            ＋ 새 목록 만들기
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 목록 이름"
              autoComplete="off"
              className="flex-1 rounded-xl border-2 border-transparent bg-card-hover p-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
            <button onClick={createAndAdd} className="bg-accent rounded-xl px-4 text-sm font-bold text-white">만들기</button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
