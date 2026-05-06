import { BrandLogo } from "./brand-logo"

export function RouteLoadingScreen() {
  return (
    <div
      className="
        viewport-page
        flex items-center justify-center
        bg-app-radial
        animate-fade-in
      "
      data-testid="route-loading-screen"
    >
      <BrandLogo color="#FFFFFF" width={96} />
    </div>
  )
}
