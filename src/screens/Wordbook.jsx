import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as wordbook from '../lib/wordbook.js'
import WordSheet from '../components/WordSheet.jsx'
import WordStudy from './WordStudy.jsx'
import { Sheet, Row, CheckDot } from '../components/Sheet.jsx'

// 단어장: 단어장/오답/커스텀을 상단 칩으로 전환하는 단일 화면.
// 암기·문제풀기 + 단어 목록. 선택모드로 체크박스 다중선택 → 일괄 빼기/다른 목록에 추가.
export default function Wordbook() {
  const nav = useNavigate()
  const [coll, setColl] = useState('book') // 'book' | 'wrong' | ['custom', name]
  const [action, setAction] = useState(null) // null | 'flash' | 'quiz'
  const [sheetWord, setSheetWord] = useState(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [selMode, setSelMode] = useState(false)
  const [sel, setSel] = useState(() => new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [, setVer] = useState(0)
  const refresh = () => setVer((v) => v + 1)

  const isCustom = Array.isArray(coll) && coll[0] === 'custom'
  const title = isCustom ? coll[1] : coll === 'book' ? '단어장' : '오답 단어'
  const words = wordbook.items(coll)
  const wordArr = words.map((w) => [w.hj, w.rd, w.mean])

  // ----- 암기 / 문제 -----
  if (action === 'flash')
    return <WordStudy words={wordArr} mode="flash" title={`${title} 암기`} onBack={() => setAction(null)} />
  if (action === 'quiz')
    return <WordStudy words={wordArr} mode="quiz" title={`${title} 문제`} onBack={() => setAction(null)} />

  const customs = wordbook.customNames()
  const sameColl = (a) => (isCustom ? Array.isArray(a) && a[1] === coll[1] : a === coll)
  const cancelSel = () => {
    setSelMode(false)
    setSel(new Set())
  }
  const switchColl = (c) => {
    setColl(c)
    cancelSel()
  }
  const removeWord = (w) => {
    if (!confirm(`'${w.hj} (${w.rd})' 을(를) ${title}에서 뺄까요?`)) return
    wordbook.remove(w.hj, coll)
    refresh()
  }
  const solvedHj = coll === 'wrong' ? words.filter((w) => wordbook.isWrongSolved(w.hj)).map((w) => w.hj) : []
  const allSolvedSel = solvedHj.length > 0 && solvedHj.every((hj) => sel.has(hj))
  // 다시 맞힌 것들 토글: 모두 선택돼 있으면 전부 해제, 아니면 전부 선택.
  const toggleSolved = () =>
    setSel((s) => {
      const all = solvedHj.every((hj) => s.has(hj))
      const n = new Set(s)
      solvedHj.forEach((hj) => (all ? n.delete(hj) : n.add(hj)))
      return n
    })

  const toggleSel = (hj) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(hj)) n.delete(hj)
      else n.add(hj)
      return n
    })
  const allSelected = words.length > 0 && sel.size === words.length
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(words.map((w) => w.hj)))
  const bulkRemove = () => {
    if (!sel.size) return
    if (!confirm(`선택한 ${sel.size}개를 ${title}에서 뺄까요?`)) return
    sel.forEach((hj) => wordbook.remove(hj, coll))
    cancelSel()
    refresh()
  }
  const selectedWords = words.filter((w) => sel.has(w.hj))

  return (
    <>
      <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0">
          <button onClick={() => nav(-1)} className="mb-3 rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover">
            ◀ 뒤로
          </button>
          <h1 className="mb-3 text-2xl font-bold tracking-tight">📒 단어장</h1>

          {selMode ? (
            // 선택모드: 이 컨트롤들을 고정 → 스크롤해도 항상 보임(목록만 내려감). 칩·목록관리는 숨겨 목록 공간 확보.
            <div className="mb-3">
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
              {coll === 'wrong' && solvedHj.length > 0 && (
                <button
                  onClick={toggleSolved}
                  className={`mt-2 w-full rounded-xl border py-2.5 text-sm font-bold text-white ${
                    allSolvedSel ? 'bg-good/15 border-good/40 hover:bg-good/25' : 'border-white/40 hover:bg-white/5'
                  }`}
                >
                  ✓ 다시 맞힌 {solvedHj.length}개 {allSolvedSel ? '선택 해제' : '선택'}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* 컬렉션 전환 칩 — 가로 스크롤 */}
              <div className="scroll-x mb-2 flex gap-2 pb-1">
                <Chip active={sameColl('book')} onClick={() => switchColl('book')}>📒 단어장</Chip>
                <Chip active={sameColl('wrong')} onClick={() => switchColl('wrong')}>❌ 오답 단어</Chip>
                {customs.map((nm) => (
                  <Chip key={nm} active={sameColl(['custom', nm])} onClick={() => switchColl(['custom', nm])}>
                    📂 {nm}
                  </Chip>
                ))}
              </div>
              <button onClick={() => setManageOpen(true)} className="text-muted mb-3 rounded-xl bg-card/60 px-3 py-1.5 text-sm font-semibold hover:bg-card-hover">
                ⚙ 목록 관리
              </button>
            </>
          )}
        </div>

        {/* 선택모드 아님: 상단 네비(칩·목록관리)만 고정+암기/문제/선택은 스크롤. 선택모드: 위 컨트롤 고정+목록만 스크롤. */}
        <div className="screen-scroll">
          {!selMode && (
            <>
              <div className="mb-2 flex gap-2">
                <button onClick={() => setAction('flash')} disabled={!words.length} className="flex-1 rounded-xl bg-card py-2.5 text-sm font-bold hover:bg-card-hover disabled:opacity-40">
                  🃏 암기
                </button>
                <button onClick={() => setAction('quiz')} disabled={!words.length} className="bg-accent flex-1 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40">
                  📝 문제풀기
                </button>
              </div>
              <p className="text-muted mb-2 text-sm">{words.length}개</p>
              {words.length > 0 && (
                <button onClick={() => setSelMode(true)} className="bg-accent/15 border border-accent/40 hover:bg-accent/25 mb-4 w-full rounded-xl py-2.5 text-base font-bold text-white">
                  ☑️ 선택
                </button>
              )}
            </>
          )}

          {/* 단어 목록 */}
          {!words.length ? (
            <p className="text-muted text-sm">
              {coll === 'wrong' ? '단어 문제를 틀리면 여기에 쌓여요.' : '아직 담은 단어가 없어요.'}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {words.map((w) => (
                <div key={w.hj} className="flex items-center gap-2 rounded-xl bg-card p-3">
                  {selMode && <CheckDot on={sel.has(w.hj)} />}
                  <button
                    onClick={() => (selMode ? toggleSel(w.hj) : setSheetWord([w.hj, w.rd, w.mean]))}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span>
                      <span className="hanja text-lg">{w.hj}</span>
                      <span className="text-muted ml-2 text-sm">{w.rd}</span>
                      {coll === 'wrong' && wordbook.isWrongSolved(w.hj) && (
                        <span className="text-good ml-2 text-xs font-semibold">✓ 맞힘</span>
                      )}
                    </span>
                    {w.mean && <span className="text-muted mt-0.5 block truncate text-xs">{w.mean}</span>}
                  </button>
                  {!selMode && (
                    <button onClick={() => removeWord(w)} className="text-muted shrink-0 rounded-lg bg-card-hover px-3 py-1.5 text-sm">
                      빼기
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <WordSheet word={sheetWord} onClose={() => { setSheetWord(null); refresh() }} />
      <ListManagerSheet open={manageOpen} onClose={() => setManageOpen(false)} onChanged={refresh} onPick={(nm) => switchColl(['custom', nm])} />
      <AddToSheet open={addOpen} words={selectedWords} onClose={() => setAddOpen(false)} onAdded={() => { cancelSel(); refresh() }} />
    </>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
        active ? 'bg-accent text-white' : 'bg-card text-muted hover:bg-card-hover'
      }`}
    >
      {children}
    </button>
  )
}

// 선택한 단어들을 다른 컬렉션에 추가. 이미 (전부) 들어있는 목록은 후보에서 제외.
function AddToSheet({ open, words, onClose, onAdded }) {
  const [, setVer] = useState(0)
  const customs = wordbook.customNames()
  const cands = [
    { coll: 'book', label: '📒 단어장' },
    { coll: 'wrong', label: '❌ 오답 단어' },
    ...customs.map((nm) => ({ coll: ['custom', nm], label: `📂 ${nm}` })),
  ].filter((c) => words.some((w) => !wordbook.contains(w.hj, c.coll))) // 추가할 게 남은 목록만
  const addTo = (coll) => {
    words.forEach((w) => wordbook.add(w.hj, w.rd, w.mean, coll))
    onAdded()
    onClose()
  }
  const newList = () => {
    const nm = prompt('새 목록 이름')?.trim()
    if (!nm) return
    if (customs.includes(nm)) {
      alert(`'${nm}' 목록이 이미 있어요.`)
      return
    }
    wordbook.customCreate(nm)
    words.forEach((w) => wordbook.add(w.hj, w.rd, w.mean, ['custom', nm]))
    setVer((v) => v + 1)
    onAdded()
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={`${words.length}개를 어디에 추가할까요?`}>
      <div className="flex flex-col gap-2">
        {cands.map((c) => (
          <Row key={c.label} onClick={() => addTo(c.coll)}>{c.label}</Row>
        ))}
        {!cands.length && <p className="text-muted text-sm">선택한 단어가 이미 모든 목록에 들어 있어요.</p>}
        <Row onClick={newList} accent>＋ 새 목록 만들어 추가</Row>
      </div>
    </Sheet>
  )
}

// 커스텀 목록 추가/삭제. 동일명이 있으면 알림(덮어쓰기·병합 안 함).
function ListManagerSheet({ open, onClose, onChanged, onPick }) {
  const [newName, setNewName] = useState('')
  const [, setVer] = useState(0)
  const refresh = () => setVer((v) => v + 1)
  const customs = wordbook.customNames()
  const create = () => {
    const nm = newName.trim()
    if (!nm) return
    if (customs.includes(nm)) {
      alert(`'${nm}' 목록이 이미 있어요.`)
      return
    }
    wordbook.customCreate(nm)
    setNewName('')
    onChanged()
    onPick(nm)
    onClose()
  }
  const del = (nm) => {
    if (!confirm(`'${nm}' 목록을 삭제할까요? 담긴 단어도 함께 사라져요.`)) return
    wordbook.customDelete(nm)
    onChanged()
    refresh()
  }
  return (
    <Sheet open={open} onClose={onClose} title="목록 관리">
      <div className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="새 목록 이름"
          autoComplete="off"
          className="flex-1 rounded-xl border-2 border-transparent bg-card-hover p-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <button onClick={create} className="bg-accent rounded-xl px-4 py-2 text-sm font-bold text-white">만들기</button>
      </div>
      {!customs.length ? (
        <p className="text-muted py-2 text-sm">아직 만든 목록이 없어요.</p>
      ) : (
        <div className="screen-scroll flex max-h-[40vh] flex-col gap-2">
          {customs.map((nm) => (
            <div key={nm} className="flex items-center gap-2 rounded-xl bg-card-hover p-3">
              <span className="min-w-0 flex-1 truncate font-semibold">📂 {nm}</span>
              <span className="text-muted text-sm">{wordbook.count(['custom', nm])}개</span>
              <button onClick={() => del(nm)} className="text-bad bg-bad/15 shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold">삭제</button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
