import Foundation

struct JourneyWidgetSnapshot: Codable, Equatable {
    static let kind = "MindscapeAspiration"
    static let appGroup = "group.com.junwonseo.mindscape"
    private static let key = "aspiration-widget-snapshot"

    let hasAspiration: Bool
    let score: Int?
    let weekChange: Int?

    static let empty = Self(hasAspiration: false, score: nil, weekChange: nil)
    static let example = Self(hasAspiration: true, score: 72, weekChange: 8)

    static func load() -> Self {
        guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: key),
              let snapshot = try? JSONDecoder().decode(Self.self, from: data) else { return .empty }
        return snapshot
    }

    @discardableResult
    func saveIfChanged() -> Bool {
        guard self != Self.load(), let defaults = UserDefaults(suiteName: Self.appGroup),
              let data = try? JSONEncoder().encode(self) else { return false }
        defaults.set(data, forKey: Self.key)
        return true
    }
}
