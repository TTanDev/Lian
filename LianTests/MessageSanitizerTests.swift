import Testing
@testable import Lian

struct MessageSanitizerTests {
    @Test
    func removesMetadataLines() {
        let raw = """
        发送时间：22:15
        消息正文：图片我看不太清诶
        图片数量：1 张
        """

        #expect(MessageSanitizer.clean(raw) == "图片我看不太清诶")
    }

    @Test
    func keepsNormalMultilineReply() {
        let raw = "辛苦啦\n早点休息"
        #expect(MessageSanitizer.clean(raw) == raw)
    }
}
