import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as progress from '../lib/progress.js'

// 한자 '목록에 담기' 바텀시트 — 단어장 담기(WordSheet)의 한자 버전.
// 즐겨찾기 + 내가 만든 커스텀 한자목록에 담기/빼기 + 새 목록 만들기.
// hanja: { id, c, label(훈음) } | null
export default function HanjaListSheet({ hanja, onClose }) {
  const open = !!hanja
  const [, setVer] = useState(0)
  const [names, setNames] = useState([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  useEffect(() => {
    if (hanja) {
      setNames(progress.customNames())
      setAdding(false)
      setNewName('')
    }
  }, [hanja])
  const refresh = () => setVer((v) => v + 1)
  const fav = hanja ? progress.isFavorite(hanja.id) : false

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[640px] rounded-t-3xl bg-card px-5 pt-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="flex items-center gap-3">
              <span className="hanja text-4xl font-bold leading-none">{hanja.c}</span>
              <span className="text-muted text-base">{hanja.label}</span>
            </div>

            <button
              onClick={() => { progress.toggleFavorite(hanja.id); refresh() }}
              className={`mt-5 w-full rounded-2xl py-3.5 font-bold transition-colors ${
                fav ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-accent text-white'
              }`}
            >
              {fav ? '★ 즐겨찾기에 있음 · 빼기' : '☆ 즐겨찾기에 담기'}
            </button>

            <div className="mt-4">
              <div className="text-muted mb-2 text-sm">내 목록에 담기</div>
              <div className="flex flex-wrap gap-2">
                {names.map((nm) => {
                  const on = progress.inCustom(hanja.id, nm)
                  return (
                    <button
                      key={nm}
                      onClick={() => { progress.toggleCustom(hanja.id, nm); refresh() }}
                      className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
                        on ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-card-hover text-muted'
                      }`}
                    >
                      {on ? '✓ ' : ''}
                      {nm}
                    </button>
                  )
                })}
                {!adding ? (
                  <button onClick={() => setAdding(true)} className="text-accent rounded-xl bg-card-hover px-3 py-1.5 text-sm font-semibold">
                    ＋ 새 목록
                  </button>
                ) : (
                  <div className="flex w-full gap-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="목록 이름"
                      autoComplete="off"
                      className="flex-1 rounded-xl border-2 border-transparent bg-card-hover p-2 text-sm outline-none placeholder:text-muted focus:border-accent"
                    />
                    <button
                      onClick={() => {
                        const nm = newName.trim()
                        if (nm) {
                          progress.customCreate(nm)
                          progress.addCustom(hanja.id, nm)
                          setNames(progress.customNames())
                        }
                        setNewName('')
                        setAdding(false)
                      }}
                      className="bg-accent rounded-xl px-3 py-2 text-sm font-bold text-white"
                    >
                      만들기
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
