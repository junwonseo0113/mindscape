import SwiftUI
import WidgetKit

private let journeyURL = URL(string: "mindscape://widget/journey")!

private struct AspirationEntry: TimelineEntry {
    let date = Date()
    let snapshot: JourneyWidgetSnapshot
}

private struct AspirationProvider: TimelineProvider {
    func placeholder(in context: Context) -> AspirationEntry {
        AspirationEntry(snapshot: .example)
    }

    func getSnapshot(in context: Context, completion: @escaping (AspirationEntry) -> Void) {
        completion(AspirationEntry(snapshot: context.isPreview ? .example : .load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AspirationEntry>) -> Void) {
        completion(Timeline(entries: [AspirationEntry(snapshot: .load())], policy: .never))
    }
}

private struct AspirationWidgetView: View {
    let snapshot: JourneyWidgetSnapshot
    @Environment(\.widgetFamily) private var family
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let paper = Color(red: 1, green: 0.988, blue: 0.965)
    private let ink = Color(red: 0.15, green: 0.22, blue: 0.25)
    private let sea = Color(red: 0.22, green: 0.42, blue: 0.46)
    private let gold = Color(red: 0.71, green: 0.44, blue: 0.12)

    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            content.containerBackground(for: .widget) { background }
        } else {
            content.padding(16).background(background)
        }
    }

    private var background: some View {
        paper.overlay(
            LinearGradient(colors: [gold.opacity(0.13), .clear, sea.opacity(0.16)],
                           startPoint: .topTrailing, endPoint: .bottomLeading)
        )
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 5) {
            Label("Your Journey", systemImage: "sparkle")
                .font(.caption.weight(.semibold))
                .foregroundStyle(sea)
            if let score = snapshot.score {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    if #available(iOSApplicationExtension 17.0, *) {
                        Text(score.formatted())
                            .contentTransition(reduceMotion ? .identity : .numericText())
                            .animation(reduceMotion ? nil : .easeInOut(duration: 0.7), value: score)
                    } else {
                        Text(score.formatted())
                    }
                    Text("/100").font(.caption).foregroundStyle(sea)
                    Spacer(minLength: 0)
                }
                .font(.system(size: family == .systemMedium ? 37 : 32, weight: .regular, design: .serif))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Closeness to your aspiration: \(score) out of 100")
                if let change = snapshot.weekChange {
                    changeLabel(change)
                }
                VoyageTrack(progress: Double(score) / 100, ink: ink, sea: sea, gold: gold)
                    .frame(maxHeight: .infinity)
                    .accessibilityHidden(true)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.85), value: score)
            } else {
                Spacer(minLength: 2)
                Text(snapshot.hasAspiration ? "Your voyage begins with an entry." : "Who do you want to become?")
                    .font(.system(.title3, design: .serif))
                    .minimumScaleFactor(0.8)
                    .lineLimit(3)
                Spacer(minLength: 2)
                Text(snapshot.hasAspiration ? "Open your journey" : "Set an aspiration")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(sea)
            }
        }
        .foregroundStyle(ink)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(journeyURL)
    }

    private func changeLabel(_ change: Int) -> some View {
        Group {
            if change > 0 {
                Text("\(change) closer this week")
            } else if change < 0 {
                Text("\(-change) further this week")
            } else {
                Text("Steady this week")
            }
        }
        .font(.caption2)
        .foregroundStyle(sea)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
}

private struct VoyageTrack: View {
    let progress: Double
    let ink: Color
    let sea: Color
    let gold: Color

    var body: some View {
        GeometryReader { proxy in
            let start = CGPoint(x: 4, y: proxy.size.height * 0.68)
            let end = CGPoint(x: proxy.size.width - 7, y: proxy.size.height * 0.35)
            let bend = CGPoint(x: proxy.size.width * 0.45, y: proxy.size.height * 0.95)
            let route = Path { line in
                line.move(to: start)
                line.addQuadCurve(to: end, control: bend)
            }
            ZStack {
                route.stroke(sea.opacity(0.60), style: StrokeStyle(lineWidth: 1, dash: [2, 4]))
                SailedTrack(progress: min(1, max(0, progress)), start: start, bend: bend, end: end)
                    .stroke(gold, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                Image(systemName: "sparkle")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(gold)
                    .position(end)
                BoatMarker(progress: min(1, max(0, progress)), start: start, bend: bend, end: end)
                    .foregroundStyle(ink)
            }
        }
    }
}

private func mix(_ a: CGPoint, _ b: CGPoint, _ t: CGFloat) -> CGPoint {
    CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t)
}

private struct SailedTrack: Shape {
    var progress: Double
    let start: CGPoint
    let bend: CGPoint
    let end: CGPoint

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let t = CGFloat(progress)
        let control = mix(start, bend, t)
        let position = mix(control, mix(bend, end, t), t)
        return Path { line in
            line.move(to: start)
            line.addQuadCurve(to: position, control: control)
        }
    }
}

private struct BoatMarker: View, Animatable {
    var progress: Double
    let start: CGPoint
    let bend: CGPoint
    let end: CGPoint

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        let t = CGFloat(progress)
        let position = mix(mix(start, bend, t), mix(bend, end, t), t)
        Image(systemName: "sailboat.fill")
            .font(.system(size: 17))
            .position(x: position.x, y: position.y - 7)
    }
}

struct AspirationWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: JourneyWidgetSnapshot.kind, provider: AspirationProvider()) { entry in
            AspirationWidgetView(snapshot: entry.snapshot)
        }
        .configurationDisplayName("Mindscape Journey")
        .description("See how close your recent entries bring you to your aspiration.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
