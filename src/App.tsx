import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { StudyProvider } from "./context/study-context"
import { FeedPage } from "./pages/feed-page"
import { SplashPage } from "./pages/splash-page"
import { ThanksPage } from "./pages/thanks-page"
import { WelcomePage } from "./pages/welcome-page"

export default function App() {
  return (
    <BrowserRouter>
      <StudyProvider>
        <Routes>
          <Route path="/" element={<Navigate replace to="/splash" />} />
          <Route path="/splash" element={<SplashPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/timer" element={<Navigate replace to="/feed" />} />
          <Route path="/thank-you" element={<ThanksPage />} />
          <Route path="*" element={<Navigate replace to="/splash" />} />
        </Routes>
      </StudyProvider>
    </BrowserRouter>
  )
}
