import { Component, type ErrorInfo, type ReactNode } from "react"
import { reportRuntimeIssue } from "../utils/runtime-monitoring"

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportRuntimeIssue({
      error,
      level: "error",
      message: "Unhandled React render error reached the app boundary.",
      metadata: {
        componentStack: errorInfo.componentStack,
      },
      scope: "app-error-boundary",
    })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleBackToSplash = () => {
    window.location.assign("/splash")
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        className="min-h-svh flex items-center justify-center bg-app-radial p-6 text-ink"
        data-testid="app-error-boundary-fallback"
      >
        <div className="w-full max-w-md rounded-3xl bg-white px-8 py-10 shadow-phone">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-haze">
            Terjadi gangguan
          </p>
          <h1 className="mt-3 text-3xl font-medium">Aplikasi perlu dimuat ulang.</h1>
          <p className="mt-4 text-base leading-relaxed text-haze">
            Terjadi error tak terduga di luar alur studi normal. Muat ulang aplikasi
            untuk mencoba lagi, atau kembali ke layar awal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center rounded-full bg-violet px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(119,109,255,0.28)] transition-transform active:scale-95"
              onClick={this.handleReload}
              type="button"
            >
              Muat ulang
            </button>
            <button
              className="inline-flex items-center justify-center rounded-full border border-violet/20 bg-white px-5 py-3 text-sm font-semibold text-violet transition-transform active:scale-95"
              onClick={this.handleBackToSplash}
              type="button"
            >
              Kembali ke awal
            </button>
          </div>
        </div>
      </div>
    )
  }
}
