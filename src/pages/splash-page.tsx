import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { BrandLogo } from "../components/brand-logo"

export function SplashPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      navigate("/welcome", { replace: true })
    }, 1400)

    return () => window.clearTimeout(timeoutId)
  }, [navigate])

  return (
    <div
      className="
        min-h-svh
        flex items-center justify-center
        bg-app-radial
        animate-fade-in
      "
    >
      <BrandLogo color="#FFFFFF" width={96} />
    </div>
  )
}
