import SwiftUI
import UIKit

struct CharacterAvatar: View {
    let character: CharacterProfile
    var size: CGFloat

    var body: some View {
        Group {
            if let image = avatarImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Circle()
                    .fill(.pink.gradient)
                    .overlay {
                        Text(character.name.prefix(1))
                            .font(.system(size: size * 0.36, weight: .bold))
                            .foregroundStyle(.white)
                    }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var avatarImage: UIImage? {
        guard let path = character.avatarPath, !path.isEmpty else { return nil }
        if let url = URL(string: path), url.isFileURL {
            return UIImage(contentsOfFile: url.path)
        }
        guard let support = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ) else {
            return nil
        }
        return UIImage(contentsOfFile: support.appending(path: path).path)
    }
}
