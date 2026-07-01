import { AnimatePresence, motion } from 'framer-motion'
import { exampleWords, gradeOptions } from '../lib/hanja.js'
import * as progress from '../lib/progress.js'
import * as wordbook from '../lib/wordbook.js'

// 한자 상세 바텀시트: 탭한 한자의 훈음·부수·급수·예시단어 + 네이버 한자사전 바로가기.
// 데스크탑(파이썬)의 '사전 버튼→브라우저'를 모바일 인앱 시트로 이식. 획수는 일단 제외.
// 외부 한자사전 — 원하는 곳 선택. 네이버는 entry URL이 고유 id라 검색 URL(#/search?query=)로 이동.
const NAVER = 'https://hanja.dict.naver.com/#/search?query='
const DAUM = 'https://dic.daum.net/search.do?dic=hanja&q='

export default function HanjaSheet({ char, all, onClose, onStar, onPickWord }) {
  const open = !!char
  const h = open ? (all || []).find((x) => x.c === char) : null

  const readings = h ? h.r.map((p) => p.join(' ')).join('   ·   ') : ''
  const gradeLabel = h ? gradeOptions().find((o) => o.grade === h.g)?.label : ''
  const exs = open ? exampleWords(char).slice(0, 8) : []
  const fav = h ? progress.inAnyList(h.id) : false // 즐겨찾기·커스텀 어디든 담겨있으면 색칠

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

            <div className="flex items-start gap-4">
              <div className="brand-hanja shrink-0 text-6xl leading-none">{char}</div>
              <div className="min-w-0 flex-1 pt-1">
                <div className="hanja text-lg">{readings || '—'}</div>
                <div className="text-muted mt-1.5 text-sm">
                  {h?.radc && <span>부수 <span className="hanja">{h.radc}</span></span>}
                  {gradeLabel && <span> · {gradeLabel}</span>}
                </div>
              </div>
              {h && onStar && (
                <button
                  onClick={() => onStar({ id: h.id, c: char, label: readings })}
                  className={`shrink-0 text-2xl leading-none ${fav ? 'text-gold' : 'text-muted'}`}
                  aria-label="목록에 담기"
                >
                  {fav ? '★' : '☆'}
                </button>
              )}
            </div>

            {exs.length > 0 && (
              <div className="mt-4">
                <div className="text-muted mb-2 text-xs">예시 단어 · 탭하면 뜻·단어장</div>
                <div className="flex flex-wrap gap-2">
                  {exs.map((w, i) => (
                    <button
                      key={i}
                      onClick={() => onPickWord?.(w)}
                      className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                        wordbook.containsAny(w[0]) ? 'bg-gold/15 text-gold' : 'bg-card-hover hover:bg-card'
                      }`}
                    >
                      <span className="hanja">{w[0]}</span>
                      <span className={`ml-1.5 text-xs ${wordbook.containsAny(w[0]) ? 'text-gold/80' : 'text-muted'}`}>{w[1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => window.open(NAVER + encodeURIComponent(char), '_blank', 'noopener')}
                className="flex-1 rounded-2xl bg-card-hover py-3.5 text-sm font-bold hover:bg-card"
              >
                네이버 사전 ↗
              </button>
              <button
                onClick={() => window.open(DAUM + encodeURIComponent(char), '_blank', 'noopener')}
                className="flex-1 rounded-2xl bg-card-hover py-3.5 text-sm font-bold hover:bg-card"
              >
                다음 사전 ↗
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
