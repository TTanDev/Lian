import SwiftUI
import UIKit

struct ImagePreviewItem: Identifiable, Hashable {
    let id = UUID()
    var images: [PreviewImage]
    var startIndex: Int
}

struct PreviewImage: Identifiable, Hashable {
    let id = UUID()
    var image: UIImage
}

struct ImagePreviewView: View {
    let item: ImagePreviewItem
    @Environment(\.dismiss) private var dismiss
    @State private var selection: UUID
    @State private var shareImage: ShareImage?

    init(item: ImagePreviewItem) {
        self.item = item
        let safeIndex = min(max(item.startIndex, 0), max(item.images.count - 1, 0))
        _selection = State(initialValue: item.images[safeIndex].id)
    }

    var body: some View {
        NavigationStack {
            TabView(selection: $selection) {
                ForEach(item.images) { preview in
                    ZoomableImage(image: preview.image)
                        .tag(preview.id)
                        .ignoresSafeArea()
                }
            }
            .tabViewStyle(.page(indexDisplayMode: item.images.count > 1 ? .automatic : .never))
            .background(Color.black.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭", systemImage: "xmark") { dismiss() }
                        .foregroundStyle(.white)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("分享", systemImage: "square.and.arrow.up") {
                        shareImage = currentShareImage
                    }
                    .foregroundStyle(.white)
                }
            }
            .sheet(item: $shareImage) { image in
                ActivityView(items: [image.image])
                    .ignoresSafeArea()
            }
        }
    }

    private var currentShareImage: ShareImage? {
        item.images.first { $0.id == selection }.map { ShareImage(image: $0.image) }
    }
}

private struct ShareImage: Identifiable {
    let id = UUID()
    var image: UIImage
}

private struct ZoomableImage: UIViewRepresentable {
    let image: UIImage

    func makeUIView(context: Context) -> UIScrollView {
        let scrollView = UIScrollView()
        scrollView.minimumZoomScale = 1
        scrollView.maximumZoomScale = 4
        scrollView.delegate = context.coordinator
        scrollView.backgroundColor = .black

        let imageView = UIImageView(image: image)
        imageView.contentMode = .scaleAspectFit
        imageView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(imageView)
        context.coordinator.imageView = imageView

        NSLayoutConstraint.activate([
            imageView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            imageView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            imageView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            imageView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
            imageView.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor)
        ])
        return scrollView
    }

    func updateUIView(_ scrollView: UIScrollView, context: Context) {
        context.coordinator.imageView?.image = image
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, UIScrollViewDelegate {
        var imageView: UIImageView?

        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            imageView
        }
    }
}

private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
