import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as wordbook from '../lib/wordbook.js'

// 단어 상세 바텀시트(모바일): 탭한 단어의 한자어·읽기·뜻 + 단어장 추가/빼기 토글.
// 데스크탑의 hover(뜻)+click(단어장)을 모바일에 맞게 '탭→시트'로 변환.
export default function WordSheet({ word, onClose }) {
  const open = !!word
  const [inBook, setInBook] = useState(false)
  const [names, setNames] = useState([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [, setVer] = useState(0)
  useEffect(() => {
    if (word) {
      setInBook(wordbook.contains(word[0]))
      setNames(wordbook.customNames())
      setAdding(false)
      setNewName('')
    }
  }, [word])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[640px] rounded-t-3xl bg-card px-5 pt-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="hanja text-4xl font-bold leading-none">{word[0]}</div>
            <div className="text-accent mt-1.5 text-lg">{word[1]}</div>
            {word[2] && (
              <div className="screen-scroll text-muted mt-3 max-h-40 text-sm leading-relaxed">
                {word[2]}
              </div>
            )}
            <button
              onClick={() => setInBook(wordbook.toggle(word[0], word[1], word[2] || ''))}
              className={`mt-5 w-full rounded-2xl py-3.5 font-bold transition-colors ${
                inBook ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-accent text-white'
              }`}
            >
              {inBook ? '✓ 단어장에 있음 · 빼기' : '＋ 단어장에 추가'}
            </button>

            <div className="mt-4">
              <div className="text-muted mb-2 text-sm">내 목록에 담기</div>
              <div className="flex flex-wrap gap-2">
                {names.map((nm) => {
                  const on = wordbook.contains(word[0], ['custom', nm])
                  return (
                    <button
                      key={nm}
                      onClick={() => {
                        wordbook.toggle(word[0], word[1], word[2] || '', ['custom', nm])
                        setVer((v) => v + 1)
                      }}
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
                          wordbook.customCreate(nm)
                          wordbook.add(word[0], word[1], word[2] || '', ['custom', nm])
                          setNames(wordbook.customNames())
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
