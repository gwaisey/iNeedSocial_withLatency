type BrandLogoProps = {
  color: string
  width: number
}

export function BrandLogo({ color, width }: BrandLogoProps) {
  const dotSize = width * 0.23
  const markHeight = width * 0.673

  return (
    <div className="relative" style={{ height: dotSize + markHeight + 2, width }}>
      <span
        className="absolute left-1/2 top-0 rounded-full"
        style={{
          backgroundColor: color,
          height: dotSize,
          transform: "translateX(-50%)",
          width: dotSize,
        }}
      />
      <svg
        className="absolute bottom-0 left-1/2"
        fill={color}
        style={{ height: markHeight, transform: "translateX(-50%)", width }}
        viewBox="0 0 49 33"
      >
        <path d="M8.225 33C-0.389 33-1.505 26.5 1.526 15C2.711 10.5 18.496 0 24.496 0C30.495 0 46.2 10.198 47.466 15C50.495 26.5 49.38 33 40.766 33C36.938 33 33.495 29 32.152 24C31.76 22.54 28.224 18.249 24.32 18.249C20.416 18.249 17.24 22.533 16.839 24C15.414 29.217 12.053 33 8.225 33Z" />
      </svg>
    </div>
  )
}
