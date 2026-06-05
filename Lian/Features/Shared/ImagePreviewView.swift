import SwiftUI
import UIKit

struct ImagePreviewItem: Identifiable {
    let id = UUID()
    var images: [PreviewImage]
    var startIndex: Int
}

struct PreviewImage: Identifiable {
    var id: String
    var image: UIImage
}

struct ImagePreviewView: View {
    let item: ImagePreviewItem
    let namespace: Namespace.ID?
    let onDismiss: (() -> Void)?
    @Environment(\.dismiss) private var environmentDismiss

    @State private var selection: String
    @State private var shareImage: ShareImage?
    @State private var dragOffset: CGSize = .zero

    init(item: ImagePreviewItem, namespace: Namespace.ID? = nil, onDismiss: (() -> Void)? = nil) {
        self.item = item
        self.namespace = namespace
        self.onDismiss = onDismiss
        let safeIndex = min(max(item.startIndex, 0), max(item.images.count - 1, 0))
        _selection = State(initialValue: item.images[safeIndex].id)
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.black
                .opacity(backgroundOpacity)
                .ignoresSafeArea()
                .onTapGesture { dismiss() }

            TabView(selection: $selection) {
                ForEach(item.images) { preview in
                    ZoomableImage(image: preview.image)
                        .matchedPreview(id: preview.id, namespace: namespace, isSource: false)
                        .tag(preview.id)
                        .ignoresSafeArea()
                }
            }
            .tabViewStyle(.page(indexDisplayMode: item.images.count > 1 ? .automatic : .never))
            .offset(dragOffset)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        guard value.translation.height > 0 else { return }
                        dragOffset = value.translation
                    }
                    .onEnded { value in
                        if value.translation.height > 120 {
                            dismiss()
                        } else {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
                                dragOffset = .zero
                            }
                        }
                    }
            )

            HStack {
                Button("关闭", systemImage: "xmark") { dismiss() }
                    .labelStyle(.iconOnly)
                Spacer()
                Button("分享", systemImage: "square.and.arrow.up") {
                    shareImage = currentShareImage
                }
                .labelStyle(.iconOnly)
            }
            .font(.title3.bold())
            .foregroundStyle(.white)
            .padding()
            .opacity(backgroundOpacity)
        }
        .sheet(item: $shareImage) { image in
            ActivityView(items: [image.image])
                .ignoresSafeArea()
        }
    }

    private var backgroundOpacity: Double {
        max(0.18, 1 - Double(abs(dragOffset.height)) / 360)
    }

    private var currentShareImage: ShareImage? {
        item.images.first { $0.id == selection }.map { ShareImage(image: $0.image) }
    }

    private func dismiss() {
        withAnimation(.spring(response: 0.34, dampingFraction: 0.86)) {
            if let onDismiss {
                onDismiss()
            } else {
                environmentDismiss()
            }
        }
    }
}

extension View {
    @ViewBuilder
    func matchedPreview(id: String, namespace: Namespace.ID?, isSource: Bool = true) -> some View {
        if let namespace {
            self.matchedGeometryEffect(id: id, in: namespace, isSource: isSource)
        } else {
            self
        }
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
