#!/usr/bin/env swift

import AppKit
import Foundation

private let canvasSize = NSSize(width: 660, height: 440)
private let sourceURL = URL(fileURLWithPath: "build/dmg-background-art.png")

private func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
    NSColor(
        red: CGFloat((hex >> 16) & 0xff) / 255,
        green: CGFloat((hex >> 8) & 0xff) / 255,
        blue: CGFloat(hex & 0xff) / 255,
        alpha: alpha
    )
}

private func drawText(
    _ text: String,
    at point: NSPoint,
    font: NSFont,
    color: NSColor,
    tracking: CGFloat = 0,
    alignment: NSTextAlignment = .left,
    width: CGFloat = 560
) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color,
        .kern: tracking,
        .paragraphStyle: paragraph,
    ]
    NSAttributedString(string: text, attributes: attributes).draw(
        in: NSRect(x: point.x, y: point.y, width: width, height: font.pointSize * 1.7)
    )
}

private func drawBrandMark() {
    let colors = [
        color(0x6F91ED), color(0x315FD6), color(0x315FD6), color(0x1F3D8C),
        color(0x315FD6), color(0x6F91ED), color(0x1F3D8C), color(0x315FD6),
    ]
    for index in 0..<8 {
        let column = index % 4
        let row = index / 4
        let rect = NSRect(
            x: 42 + CGFloat(column) * 9,
            y: 390 - CGFloat(row) * 9,
            width: 6,
            height: 6
        )
        colors[index].setFill()
        NSBezierPath(roundedRect: rect, xRadius: 1.7, yRadius: 1.7).fill()
    }
}

private func drawArrow() {
    let lineY: CGFloat = 206
    let startX: CGFloat = 274
    let endX: CGFloat = 386

    let glow = NSShadow()
    glow.shadowColor = color(0x315FD6, alpha: 0.18)
    glow.shadowBlurRadius = 8
    glow.shadowOffset = NSSize(width: 0, height: -1)
    NSGraphicsContext.saveGraphicsState()
    glow.set()

    let path = NSBezierPath()
    path.move(to: NSPoint(x: startX, y: lineY))
    path.line(to: NSPoint(x: endX, y: lineY))
    path.lineWidth = 2.5
    path.lineCapStyle = .round
    color(0x315FD6, alpha: 0.88).setStroke()
    path.stroke()

    let arrowhead = NSBezierPath()
    arrowhead.move(to: NSPoint(x: endX - 13, y: lineY + 11))
    arrowhead.line(to: NSPoint(x: endX, y: lineY))
    arrowhead.line(to: NSPoint(x: endX - 13, y: lineY - 11))
    arrowhead.lineWidth = 2.5
    arrowhead.lineCapStyle = .round
    arrowhead.lineJoinStyle = .round
    color(0x315FD6, alpha: 0.96).setStroke()
    arrowhead.stroke()

    NSGraphicsContext.restoreGraphicsState()
}

private func drawBackground(scale: Int, outputPath: String) throws {
    guard let source = NSImage(contentsOf: sourceURL) else {
        throw NSError(domain: "DeckThreadsDMG", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Could not load \(sourceURL.path)",
        ])
    }

    let pixelWidth = Int(canvasSize.width) * scale
    let pixelHeight = Int(canvasSize.height) * scale
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: pixelWidth,
        pixelsHigh: pixelHeight,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        throw NSError(domain: "DeckThreadsDMG", code: 2)
    }
    bitmap.size = canvasSize

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSGraphicsContext.current?.imageInterpolation = .high

    let sourceSize = source.size
    let sourceAspect = sourceSize.width / sourceSize.height
    let targetAspect = canvasSize.width / canvasSize.height
    let sourceRect: NSRect
    if sourceAspect > targetAspect {
        let cropWidth = sourceSize.height * targetAspect
        sourceRect = NSRect(
            x: (sourceSize.width - cropWidth) / 2,
            y: 0,
            width: cropWidth,
            height: sourceSize.height
        )
    } else {
        let cropHeight = sourceSize.width / targetAspect
        sourceRect = NSRect(
            x: 0,
            y: (sourceSize.height - cropHeight) / 2,
            width: sourceSize.width,
            height: cropHeight
        )
    }
    let base = NSGradient(colors: [color(0xFBFCFE), color(0xEAF0FA)])!
    base.draw(in: NSRect(origin: .zero, size: canvasSize), angle: 90)
    source.draw(
        in: NSRect(origin: .zero, size: canvasSize),
        from: sourceRect,
        operation: .sourceOver,
        fraction: 0.075
    )

    let centerGlow = NSGradient(
        starting: color(0xFFFFFF, alpha: 0.88),
        ending: color(0xFFFFFF, alpha: 0)
    )!
    centerGlow.draw(
        in: NSBezierPath(ovalIn: NSRect(x: 105, y: 105, width: 450, height: 270)),
        relativeCenterPosition: .zero
    )

    color(0x6F8FCF, alpha: 0.055).setStroke()
    for x in stride(from: CGFloat(0), through: canvasSize.width, by: 44) {
        let line = NSBezierPath()
        line.move(to: NSPoint(x: x, y: 0))
        line.line(to: NSPoint(x: x, y: canvasSize.height))
        line.lineWidth = 0.5
        line.stroke()
    }
    for y in stride(from: CGFloat(0), through: canvasSize.height, by: 44) {
        let line = NSBezierPath()
        line.move(to: NSPoint(x: 0, y: y))
        line.line(to: NSPoint(x: canvasSize.width, y: y))
        line.lineWidth = 0.5
        line.stroke()
    }

    drawBrandMark()
    drawText(
        "DECK THREADS",
        at: NSPoint(x: 86, y: 385),
        font: NSFont.systemFont(ofSize: 11, weight: .semibold),
        color: color(0x1B2A46, alpha: 0.88),
        tracking: 2.4
    )
    drawText(
        "Install Deck Threads",
        at: NSPoint(x: 50, y: 340),
        font: NSFont.systemFont(ofSize: 22, weight: .semibold),
        color: color(0x111A2B),
        alignment: .center
    )
    drawText(
        "Drag the app into Applications",
        at: NSPoint(x: 50, y: 310),
        font: NSFont.systemFont(ofSize: 13, weight: .medium),
        color: color(0x52627E, alpha: 0.94),
        tracking: 0.1,
        alignment: .center
    )
    drawText(
        "DRAG TO INSTALL",
        at: NSPoint(x: 260, y: 229),
        font: NSFont.monospacedSystemFont(ofSize: 9, weight: .semibold),
        color: color(0x536B9F, alpha: 0.88),
        tracking: 1.5,
        alignment: .center,
        width: 140
    )
    drawArrow()
    drawText(
        "OPEN ONCE TO FINISH SETUP  •  macOS 13+",
        at: NSPoint(x: 50, y: 24),
        font: NSFont.monospacedSystemFont(ofSize: 9, weight: .medium),
        color: color(0x6B7890, alpha: 0.78),
        tracking: 1.2,
        alignment: .center
    )

    NSGraphicsContext.restoreGraphicsState()

    guard let data = bitmap.representation(using: .png, properties: [.compressionFactor: 0.92]) else {
        throw NSError(domain: "DeckThreadsDMG", code: 3)
    }
    try data.write(to: URL(fileURLWithPath: outputPath), options: .atomic)
}

do {
    try drawBackground(scale: 1, outputPath: "build/dmg-background.png")
    try drawBackground(scale: 2, outputPath: "build/dmg-background@2x.png")
    print("Generated build/dmg-background.png and build/dmg-background@2x.png")
} catch {
    fputs("Failed to generate DMG background: \(error)\n", stderr)
    exit(1)
}
