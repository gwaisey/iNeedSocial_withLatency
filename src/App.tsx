import { Suspense, lazy, type ReactElement } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import {
  getSessionStorage,
  isStudySessionEnded,
  isStudySessionResumable,
} from "./context/study-session-storage"
import { StudyProvider, useStudyState } from "./context/study-context"
import { RouteLoadingScreen } from "./components/route-loading-screen"
import { SplashPage } from "./pages/splash-page"
import { WelcomePage } from "./pages/welcome-page"

const FeedPageLazy = lazy(() =>
  import("./pages/feed-page").then((module) => ({ default: module.FeedPage }))
)
const ThanksPageLazy = lazy(() =>
  import("./pages/thanks-page").then((module) => ({ default: module.ThanksPage }))
)

function RequireActiveStudySession({ children }: Readonly<{ children: ReactElement }>) {
  const { sessionId } = useStudyState()

  if (!isStudySessionResumable(getSessionStorage(), sessionId)) {
    return <Navigate replace to="/welcome" />
  }

  return children
}

function RequireEndedStudySession({ children }: Readonly<{ children: ReactElement }>) {
  const { sessionId } = useStudyState()

  if (!isStudySessionEnded(getSessionStorage(), sessionId)) {
    return <Navigate replace to="/welcome" />
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <StudyProvider>
        <Routes>
          <Route path="/" element={<Navigate replace to="/splash" />} />
          <Route path="/splash" element={<SplashPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route
            path="/feed"
            element={
              <RequireActiveStudySession>
                <Suspense fallback={<RouteLoadingScreen />}>
                  <FeedPageLazy />
                </Suspense>
              </RequireActiveStudySession>
            }
          />
          <Route path="/timer" element={<Navigate replace to="/feed" />} />
          <Route
            path="/thank-you"
            element={
              <RequireEndedStudySession>
                <Suspense fallback={<RouteLoadingScreen />}>
                  <ThanksPageLazy />
                </Suspense>
              </RequireEndedStudySession>
            }
          />
          <Route path="*" element={<Navigate replace to="/splash" />} />
        </Routes>
      </StudyProvider>
    </BrowserRouter>
  )
}
