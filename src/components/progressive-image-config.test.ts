import { describe, expect, it } from "vitest"
import {
  DEFAULT_PROGRESSIVE_IMAGE_ASPECT_RATIO,
  buildProgressiveImageAspectRatio,
  getKnownProgressiveImageAspectRatio,
  getKnownProgressiveImageDimensions,
  rememberProgressiveImageAspectRatio,
} from "./progressive-image-config"

describe("progressive image config", () => {
  it("derives stable aspect ratios from generated feed image dimensions", () => {
    expect(getKnownProgressiveImageDimensions("/content/files/after.jpg")).toEqual({
      height: 680,
      width: 510,
    })
    expect(getKnownProgressiveImageAspectRatio("/content/files/after.jpg")).toBe("510 / 680")
    expect(
      getKnownProgressiveImageAspectRatio(
        "https://i-need-social-without-latency.vercel.app/content/files/after.jpg"
      )
    ).toBe("510 / 680")
  })

  it("can remember measured ratios for images outside the generated manifest", () => {
    const src = "/content/files/runtime-only-test-image.jpg"

    expect(getKnownProgressiveImageAspectRatio(src)).toBeUndefined()
    expect(buildProgressiveImageAspectRatio(0, 10)).toBeUndefined()
    expect(buildProgressiveImageAspectRatio(1200, 800)).toBe("1200 / 800")

    rememberProgressiveImageAspectRatio(src, "1200 / 800")

    expect(getKnownProgressiveImageAspectRatio(src)).toBe("1200 / 800")
  })

  it("keeps an explicit fallback ratio for unknown image shells", () => {
    expect(DEFAULT_PROGRESSIVE_IMAGE_ASPECT_RATIO).toBe("4 / 5")
  })
})
