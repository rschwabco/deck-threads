import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: mask-app-icon.swift <input.png> <output.png>\n", stderr)
  exit(64)
}

let inputPath = CommandLine.arguments[1]
let outputPath = CommandLine.arguments[2]

guard let source = NSImage(contentsOfFile: inputPath) else {
  fputs("Could not read \(inputPath)\n", stderr)
  exit(66)
}

let width = 1024
let height = 1024
guard let bitmap = NSBitmapImageRep(
  bitmapDataPlanes: nil,
  pixelsWide: width,
  pixelsHigh: height,
  bitsPerSample: 8,
  samplesPerPixel: 4,
  hasAlpha: true,
  isPlanar: false,
  colorSpaceName: .deviceRGB,
  bytesPerRow: 0,
  bitsPerPixel: 0
) else {
  fputs("Could not create the alpha bitmap\n", stderr)
  exit(70)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()

let silhouette = NSBezierPath(
  roundedRect: NSRect(x: 26, y: 26, width: 972, height: 972),
  xRadius: 220,
  yRadius: 220
)
silhouette.addClip()
source.draw(
  in: NSRect(x: 0, y: 0, width: width, height: height),
  from: .zero,
  operation: .sourceOver,
  fraction: 1
)
NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
  fputs("Could not encode the masked PNG\n", stderr)
  exit(70)
}

try png.write(to: URL(fileURLWithPath: outputPath), options: .atomic)

let cornerAlpha = bitmap.colorAt(x: 0, y: 0)?.alphaComponent ?? -1
let centerAlpha = bitmap.colorAt(x: width / 2, y: height / 2)?.alphaComponent ?? -1
print("cornerAlpha=\(cornerAlpha) centerAlpha=\(centerAlpha)")
