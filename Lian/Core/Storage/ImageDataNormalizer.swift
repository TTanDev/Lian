import Foundation
import UIKit

enum ImageDataNormalizer {
    static func jpegData(from data: Data, compressionQuality: CGFloat = 0.88) throws -> Data {
        guard let image = UIImage(data: data),
              let jpegData = image.jpegData(compressionQuality: compressionQuality) else {
            throw ChatAPIError.server("无法读取所选图片")
        }
        return jpegData
    }
}
