# Mindscape: ivory paper by day, a night desk for writing

Mindscape measures one thing above all: how far someone is from the person they said they want to be. Every screen should help them see that distance honestly.

## Two themes, and where each one lives

**Ivory (the default).** Home, Mind, Diary, Profile, settings, onboarding and account screens all use the ivory paper theme from `src/app/screenTheme.ts`. Background `#F2EEE6`, solid surface `#FBF8F2`, headings deep charcoal `#2A2621`, body text muted taupe at 65% (4.5:1 on the background, the floor for sentences), faint text at 50% for large text and icons only.

**Night desk (dark).** Only the writing flow and crisis support are dark: think, processing, sessionSummary, thinkComplete and crisisSupport (`DARK_SCREENS` in `App.tsx`), plus the full night-sky brain map. Writing at night should feel like a lamp on a desk.

**Do not make Home dark.** A navy "midnight observatory" Home was tried and was a regression twice (Nov 2026). If you're merging branches, check Home's background before pushing.

## Type

Instrument Serif for screen titles and reflective statements. A handwritten face (`hand` in `typefaces.ts`) for warm labels on the voyage and summaries. Inter for controls, body copy and navigation. JetBrains Mono only for compact metadata such as dates.

## Tabs

Home, Mind and Diary. Mind is one screen with three parts and nothing that repeats: the voyage card, today's discovery and the Insights web. The web's two drill-downs, all patterns and your sky, sit right under it. Writing counts and feelings live in Diary's "How you've changed", not in Mind. Before adding something to Mind, check that no other part of Mind already leads to the same place. The Insights web puts you in the middle with three branches: Pulls you closer, Holds you back, Still unclear. Each insight goes on a branch by whether the diary entries behind it moved you toward your aspiration or away from it. Tap a branch to list its insights. It was once split into Mind and Analysis, but both led with the same discovery.

## The voyage (the main feature)

Show distance with the voyage card, not a line graph. A day-by-day closeness graph was tried and removed: it didn't read as distance, and mood dots crept onto it.

`Voyage.tsx` draws the distance as a sea chart inked on paper: a course from where you started to a gold star (who you want to be), with your boat where your closeness puts it (`aspirationPath.ts`).

- **Fog before a number.** Closeness needs at least three steps toward or away. Until then the card shows "Getting to know you" with "1 of 3" and a soft mist over the course. The star still shows through. One entry must never read as 0 or 100.
- **Gentle drift.** When the latest three or more steps all went away, the card says "Currents pulled you off course" in muted ink. Don't show a red falling number in that case.
- **Try next.** After a step away, the analysis may suggest one small, concrete action. Home shows it under the voyage until the next entry. It is never advice about feelings.
- **Two portraits.** When an aspiration is set, the weekly reflection shows "Who you said" beside "This week showed", up to three traits each. The distance is shown in words as well as a number.

## Motion and accessibility

Motion stays gentle: boat bob, star pulse and drifting fog. Reduced-motion preferences turn decorative motion off. Every interactive control has a visible keyboard focus state, and nothing essential depends on hover. Check contrast on solid surfaces. Primary gold controls use dark text.

## Data honesty

Screens read the existing store. No sample data appears in a normal user session. Demo content is labelled as an example and never written into the personal store. Belief map nodes still require their existing approval signals. Empty states say plainly that nothing is there yet.
