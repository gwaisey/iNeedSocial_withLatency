import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import * as runtimeMonitoring from "../utils/runtime-monitoring"
import { AppErrorBoundary } from "./app-error-boundary"

function ThrowOnRender(): null {
  throw new Error("boom")
}

describe("AppErrorBoundary", () => {
  it("renders the fallback UI and reports the crash", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const reportRuntimeIssueSpy = vi
      .spyOn(runtimeMonitoring, "reportRuntimeIssue")
      .mockImplementation((input) => ({
        error: input.error instanceof Error ? { message: input.error.message } : undefined,
        level: input.level,
        message: input.message,
        metadata: input.metadata,
        scope: input.scope,
        timestamp: "2026-04-20T00:00:00.000Z",
      }))

    render(
      <AppErrorBoundary>
        <ThrowOnRender />
      </AppErrorBoundary>
    )

    expect(screen.getByTestId("app-error-boundary-fallback")).toBeInTheDocument()
    expect(screen.getByText("Aplikasi perlu dimuat ulang.")).toBeInTheDocument()
    expect(reportRuntimeIssueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        level: "error",
        message: "Unhandled React render error reached the app boundary.",
        metadata: expect.objectContaining({
          componentStack: expect.any(String),
        }),
        scope: "app-error-boundary",
      })
    )

    consoleErrorSpy.mockRestore()
  })
})
