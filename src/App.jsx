import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Menu from './screens/Menu.jsx'
import Quiz from './screens/Quiz.jsx'
import Chapters from './screens/Chapters.jsx'
import Flashcards from './screens/Flashcards.jsx'
import Wordbook from './screens/Wordbook.jsx'
import Lists from './screens/Lists.jsx'
import Schedule from './screens/Schedule.jsx'
import WordDaily from './screens/WordDaily.jsx'
import Settings from './screens/Settings.jsx'

export default function App() {
  const location = useLocation()

  // iOS는 CSS(overflow:hidden/position:fixed)로 키보드 스크롤을 못 막는다.
  // 터치 스크롤 제스처를 직접 차단하되, .screen-scroll(목록 등) 안에서는 허용한다.
  useEffect(() => {
    const onTouchMove = (e) => {
      const t = e.target
      if (!(t instanceof Element) || !t.closest('.screen-scroll, .scroll-x')) {
        e.preventDefault()
      }
    }
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => document.removeEventListener('touchmove', onTouchMove)
  }, [])

  return (
    // 모바일 퍼스트: 폰에선 꽉 차고, 큰 화면(패드/가로)에선 가운데 정렬 + 최대폭으로 '앱'처럼.
    <div className="app-shell">
      <div className="app-content">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Menu />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/builder" element={<Quiz />} />
            <Route path="/chapters" element={<Chapters />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/lists" element={<Lists />} />
            <Route path="/lists/:view" element={<Lists />} />
            <Route path="/wordbook" element={<Wordbook />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/word-daily" element={<WordDaily />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AnimatePresence>
      </div>
    </div>
  )
}
