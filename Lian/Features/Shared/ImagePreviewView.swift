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
    @State private var dragOffset: CGSize = .zero

    init(item: ImagePreviewItem, namespace: Namespace.ID? = nil, onDismiss: (() -> Void)? = nil) {
        self.item = item
        self.namespace = namespace
        self.onDismiss = onDismiss
        let safeIndex = min(max(item.startIndex, 0), max(item.images.count - 1, 0))
        _selection = State(initialValue: item.images[safeIndex].id)
    }

    var body: some View {
        ZStack {
            Color.black
                .opacity(backgroundOpacity)
                .ignoresSafeArea()

            if item.images.count > 1 {
                TabView(selection: $selection) {
                    ForEach(item.images) { preview in
                        previewImage(preview)
                            .tag(preview.id)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .automatic))
            } else if let preview = item.images.first {
                previewImage(preview)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { dismiss() }
        .gesture(
            DragGesture()
                .onChanged { value in
                    guard value.translation.height > 0 else { return }
                    dragOffset = value.translation
                }
                .onEnded { value in
                    if value.translation.height > 110 {
                        dismiss()
                    } else {
                        withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
                            dragOffset = .zero
                        }
                    }
                }
        )
        .ignoresSafeArea()
    }

    private func previewImage(_ preview: PreviewImage) -> some View {
        Image(uiImage: preview.image)
            .resizable()
            .scaledToFit()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .matchedPreview(id: preview.id, namespace: namespace, isSource: false)
            .padding(.horizontal, 0)
            .scaleEffect(previewScale)
            .offset(dragOffset)
            .animation(.spring(response: 0.34, dampingFraction: 0.88), value: dragOffset)
    }

    private var backgroundOpacity: Double {
        max(0, 1 - Double(abs(dragOffset.height)) / 260)
    }

    private var previewScale: CGFloat {
        max(0.78, 1 - abs(dragOffset.height) / 900)
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
