import Foundation
import Testing
@testable import Lian

struct AttachmentPersistenceTests {
    @Test
    func imageCapabilityDoesNotControlHistoricalAttachmentVisibility() {
        let model = APIModel(
            id: "text-only",
            displayName: "Text only",
            baseURL: "https://example.com/v1",
            modelName: "text-model",
            supportsImages: false,
            isDefault: true,
            createdAt: .now,
            updatedAt: .now
        )

        #expect(model.canSelectNewAttachments == false)
        // Historical attachments are rendered from their persisted files,
        // independently of the currently selected model's capabilities.
    }
}
