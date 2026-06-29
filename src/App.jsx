import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Menu from './screens/Menu.jsx'
import Quiz from './screens/Quiz.jsx'
import Placeholder from './screens/Placeholder.jsx'

export default function App() {
  const location = useLocation()

  // 앱 높이를 '실제 보이는 영역'(키보드 위)에 맞춘다. iOS는 키보드가 떠도 dvh를
  // 안 줄이므로 VisualViewport로 직접 읽어 --app-height 갱신 → 키보드 stuck 방지.
  useEffect(() => {
    const vv = window.visualViewport
    const setH = () => {
      const h = vv ? vv.height : window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${h}px`)
    }
    setH()
    vv?.addEventListener('resize', setH)
    vv?.addEventListener('scroll', setH)
    window.addEventListener('resize', setH)
    return () => {
      vv?.removeEventListener('resize', setH)
      vv?.removeEventListener('scroll', setH)
      window.removeEventListener('resize', setH)
    }
  }, [])

  return (
    // 모바일 퍼스트: 폰에선 꽉 차고, 큰 화면(패드/가로)에선 가운데 정렬 + 최대폭으로 '앱'처럼.
    // .app-shell이 유일한 스크롤 컨테이너(불필요한 바운스 방지) — index.css 참고.
    <div className="app-shell">
      <div className="app-content">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Menu />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/builder" element={<Placeholder title="자유 출제" />} />
            <Route path="/chapters" element={<Placeholder title="챕터별 풀이" />} />
            <Route path="/flashcards" element={<Placeholder title="플래시카드" />} />
            <Route path="/lists" element={<Placeholder title="내 목록" />} />
            <Route path="/wordbook" element={<Placeholder title="단어장" />} />
            <Route path="/settings" element={<Placeholder title="설정" />} />
          </Routes>
        </AnimatePresence>
      </div>
    </div>
  )
}
