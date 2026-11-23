import SwiftUI
import WidgetKit

private let writeURL = URL(string: "mindscape://widget/write")!
private let diaryURL = URL(string: "mindscape://widget/diary")!

private enum JournalMoment: Int, CaseIterable {
    case night = 0
    case morning = 6
    case afternoon = 12
    case evening = 18

    static func at(_ date: Date, calendar: Calendar) -> Self {
        let hour = calendar.component(.hour, from: date)
        return allCases.last(where: { $0.rawValue <= hour }) ?? .night
    }

    var prompt: LocalizedStringKey {
        switch self {
        case .morning: "What’s on your mind?"
        case .afternoon: "What has stayed with you?"
        case .evening: "What did today leave you with?"
        case .night: "What’s still on your mind?"
        }
    }

    var glowPosition: UnitPoint {
        switch self {
        case .morning: .init(x: 0.78, y: 0.20)
        case .afternoon: .init(x: 0.94, y: 0.32)
        case .evening: .init(x: 0.82, y: 0.69)
        case .night: .init(x: 0.62, y: 0.54)
        }
    }

    var glow: Color {
        switch self {
        case .morning: Color(red: 0.96, green: 0.76, blue: 0.60)
        case .afternoon: Color(red: 0.93, green: 0.77, blue: 0.52)
        case .evening: Color(red: 0.86, green: 0.69, blue: 0.78)
        case .night: Color(red: 0.70, green: 0.68, blue: 0.88)
        }
    }
}

private struct JournalEntry: TimelineEntry {
    let date: Date
    let moment: JournalMoment

    init(date: Date, calendar: Calendar = .autoupdatingCurrent) {
        self.date = date
        moment = .at(date, calendar: calendar)
    }
}

private struct JournalProvider: TimelineProvider {
    func placeholder(in context: Context) -> JournalEntry {
        JournalEntry(date: .now)
    }

    func getSnapshot(in context: Context, completion: @escaping (JournalEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<JournalEntry>) -> Void) {
        let calendar = Calendar.autoupdatingCurrent
        let now = Date.now
        let nextUpdates = JournalMoment.allCases.compactMap { moment in
            calendar.nextDate(after: now, matching: DateComponents(hour: moment.rawValue, minute: 0, second: 0),
                              matchingPolicy: .nextTime)
        }.sorted()
        let entries = ([now] + nextUpdates).map { JournalEntry(date: $0, calendar: calendar) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

private struct JournalWidgetView: View {
    let moment: JournalMoment
    @Environment(\.widgetFamily) private var family
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let paper = Color(red: 0.98, green: 0.96, blue: 0.92)
    private let ink = Color(red: 0.16, green: 0.15, blue: 0.13)
    private let plum = Color(red: 0.36, green: 0.29, blue: 0.54)

    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            content.containerBackground(for: .widget) { background }
        } else {
            content.padding(16).background(background)
        }
    }

    private var background: some View {
        GeometryReader { geometry in
            ZStack {
                paper
                Circle()
                    .fill(RadialGradient(colors: [moment.glow.opacity(0.65), paper.opacity(0)], center: .center,
                                         startRadius: 5, endRadius: 72))
                    .frame(width: 144, height: 144)
                    .position(x: geometry.size.width * moment.glowPosition.x,
                              y: geometry.size.height * moment.glowPosition.y)

                // Faint rules toward the bottom recall the app's writing paper.
                VStack(spacing: 9) {
                    ForEach(0..<3, id: \.self) { _ in
                        Rectangle().fill(plum.opacity(0.10)).frame(height: 1)
                    }
                }
                .frame(maxHeight: .infinity, alignment: .bottom)
                .padding(.horizontal, 17)
                .padding(.bottom, 15)
            }
            .clipped()
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.9), value: moment)
        }
        .accessibilityHidden(true)
    }

    private var prompt: some View {
        ZStack(alignment: .leading) {
            Text(moment.prompt)
                .font(.system(family == .systemMedium ? .title2 : .title3, design: .serif).weight(.medium))
                .foregroundStyle(ink)
                .minimumScaleFactor(0.75)
                .lineLimit(3)
                .id(moment)
                .transition(reduceMotion ? .identity : .opacity)
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.5), value: moment)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 5) {
            Label("Mindscape", systemImage: "pencil.line")
                .font(.caption.weight(.semibold))
                .foregroundStyle(plum)
            Spacer(minLength: 2)
            prompt
            Spacer(minLength: 2)
            HStack(spacing: 8) {
                Label("Write an entry", systemImage: "square.and.pencil")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(paper)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(plum, in: Capsule())
                    .accessibilityAddTraits(.isButton)
                if family == .systemMedium {
                    Spacer(minLength: 0)
                    Link(destination: diaryURL) {
                        Label("Diary", systemImage: "book.closed")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(plum)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 6)
                            .background(paper, in: Capsule())
                            .overlay(Capsule().strokeBorder(plum.opacity(0.25), lineWidth: 1))
                    }
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(writeURL)
    }
}

struct MindscapeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MindscapeJournal", provider: JournalProvider()) { entry in
            JournalWidgetView(moment: entry.moment)
        }
        .configurationDisplayName("Mindscape Diary")
        .description("Write a thought or open your diary from the Home Screen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}


@main
struct MindscapeWidgetBundle: WidgetBundle {
    var body: some Widget {
        MindscapeWidget()
        AspirationWidget()
    }
}
