import SwiftUI
import UIKit

struct AttachmentRenderer: View {
    let attachment: ChatAttachment
    let applicationSupportDirectory: URL

    var body: some View {
        let fileURL = attachment.fileURL(in: applicationSupportDirectory)

        Group {
            if attachment.isAvailable(in: applicationSupportDirectory),
               let image = UIImage(contentsOfFile: fileURL.path) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                MissingAttachmentView()
            }
        }
        .frame(maxWidth: 240, minHeight: 120, maxHeight: 320)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct MissingAttachmentView: View {
    var body: some View {
        ContentUnavailableView(
            "图片无法读取",
            systemImage: "photo.badge.exclamationmark",
            description: Text("原始图片文件可能已被移动或删除")
        )
    }
}
