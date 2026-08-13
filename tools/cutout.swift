// Tách chủ thể khỏi nền bằng Vision của macOS.
//   swiftc -O cutout.swift -o cutout && ./cutout vao.jpg ra.png
import Foundation
import Vision
import CoreImage

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("dùng: cutout <ảnh vào> <ảnh ra .png>\n".data(using: .utf8)!)
    exit(64)
}
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

guard let src = CIImage(contentsOf: inURL) else {
    FileHandle.standardError.write("không đọc được ảnh\n".data(using: .utf8)!)
    exit(1)
}

let handler = VNImageRequestHandler(ciImage: src, options: [:])
let req = VNGenerateForegroundInstanceMaskRequest()
do { try handler.perform([req]) } catch {
    FileHandle.standardError.write("Vision lỗi: \(error)\n".data(using: .utf8)!)
    exit(2)
}
guard let obs = req.results?.first else {
    FileHandle.standardError.write("không tìm thấy chủ thể nào\n".data(using: .utf8)!)
    exit(3)
}
print("số chủ thể tìm được: \(obs.allInstances.count)")

let maskPB: CVPixelBuffer
do {
    maskPB = try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler)
} catch {
    FileHandle.standardError.write("dựng mặt nạ lỗi: \(error)\n".data(using: .utf8)!)
    exit(4)
}

let mask = CIImage(cvPixelBuffer: maskPB)
    .transformed(by: CGAffineTransform(
        scaleX: src.extent.width / CGFloat(CVPixelBufferGetWidth(maskPB)),
        y: src.extent.height / CGFloat(CVPixelBufferGetHeight(maskPB))))

guard let blend = CIFilter(name: "CIBlendWithMask") else { exit(5) }
blend.setValue(src, forKey: kCIInputImageKey)
blend.setValue(CIImage(color: .clear).cropped(to: src.extent), forKey: kCIInputBackgroundImageKey)
blend.setValue(mask, forKey: kCIInputMaskImageKey)
guard let out = blend.outputImage else { exit(6) }

let ctx = CIContext()
do {
    try ctx.writePNGRepresentation(of: out, to: outURL, format: .RGBA8,
                                   colorSpace: CGColorSpaceCreateDeviceRGB())
} catch {
    FileHandle.standardError.write("ghi PNG lỗi: \(error)\n".data(using: .utf8)!)
    exit(7)
}
print("đã ghi \(outURL.lastPathComponent)")
