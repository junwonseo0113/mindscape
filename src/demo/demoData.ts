// ── Demo Mode data ────────────────────────────────────────────────────────────
// Every example belief/assumption/hypothesis/history entry that used to be
// scattered through App.tsx as separate fallback constants, unified into one
// object shaped exactly like the real on-device Store. That's the whole
// point: because this is Store-shaped, every screen just reads `store.x`
// and never has to know whether it's looking at this file or a real
// person's data — see src/app/dataProvider.ts.
//
// Kept 1:1 with the original wireframe content (same beliefs, same
// hypotheses, same evidence quotes, same investigate walkthroughs) — this
// file only reshapes it to fit the shared Store type, it doesn't invent or
// drop anything.

import type { Store } from "../app/types";

export const DEMO_STORE: Store = {
  // Cognitive-pattern tags and status vary across the five so the demo
  // actually demonstrates the CBT/ACT framework (analysisFramework.ts) —
  // without these, someone browsing in demo mode would never see the
  // framework exists at all, since it's otherwise only populated by real
  // analysis.
  beliefs: [
    {
      id: "demo-belief-0", domain: "Life overall", statement: "Safety comes first", confidence: 82, evidenceCount: 34, evidenceQuotes: [], status: "supported", possibleCognitivePatterns: ["Should statements"], thoughtLabel: "Safety-seeking thought", supportingEntryIds: ["demo-entry-0"],
      confidenceHistory: [{ date: "2026.02.10", value: 58 }, { date: "2026.04.02", value: 68 }, { date: "2026.05.20", value: 74 }, { date: "2026.07.28", value: 82 }],
    },
    {
      id: "demo-belief-1", domain: "Career", statement: "If I work hard, I'll eventually be recognized", confidence: 64, evidenceCount: 21, evidenceQuotes: [], status: "supported", possibleCognitivePatterns: ["Overgeneralization"], thoughtLabel: "Need-for-recognition thought", supportingEntryIds: ["demo-entry-1"],
      confidenceHistory: [{ date: "2026.03.05", value: 70 }, { date: "2026.05.14", value: 66 }, { date: "2026.07.25", value: 64 }],
    },
    { id: "demo-belief-2", domain: "Relationships", statement: "It's better to do things alone", confidence: 57, evidenceCount: 18, evidenceQuotes: [], status: "emerging", thoughtLabel: "Distancing thought", supportingEntryIds: ["demo-entry-2"] },
    { id: "demo-belief-3", domain: "Work", statement: "I can only start once it's perfect", confidence: 71, evidenceCount: 26, evidenceQuotes: [], status: "supported", possibleCognitivePatterns: ["All-or-nothing thinking", "Should statements"], thoughtLabel: "Perfectionism thought" },
    { id: "demo-belief-4", domain: "Values", statement: "Freedom matters more than money", confidence: 45, evidenceCount: 12, evidenceQuotes: [], status: "conflicted", thoughtLabel: "Freedom-vs-security conflict thought" },
  ],

  // Same trigger -> interpretation shape as real StoredAssumption, so the
  // demo actually demonstrates the belief/assumption distinction instead of
  // just looking like a second list of flat statements.
  assumptions: [
    { id: "demo-assumption-0", trigger: "When uncertainty shows up", interpretation: "Automatically assumes waiting is the safest choice", domains: ["Career", "Relationships", "Investing"], count: 12 },
    { id: "demo-assumption-1", trigger: "When I need to reach out to someone first", interpretation: "Assumes in advance that it'll end up costing me", domains: ["Relationships", "Negotiation"], count: 8 },
    { id: "demo-assumption-2", trigger: "When starting something new", interpretation: "Puts it off, telling myself I'm not ready yet", domains: ["Work", "Starting a business"], count: 15 },
    { id: "demo-assumption-3", trigger: "When feeling conflict or hurt", interpretation: "Hides it, thinking showing it would expose a weakness", domains: ["Relationships", "Workplace"], count: 9 },
  ],

  // The same five links ScreenHome used to hand-wire for the 3D brain graph,
  // now with real notes so the Belief Map's discovered-connections section
  // (which used to only ever appear for real data) works identically in
  // demo mode. `type` left implicit ("root") on shared-cause pairs; the
  // 0↔4 pair is marked "contradiction" — belief 0 and belief 4 point
  // opposite directions (safety vs. freedom), which is exactly what
  // ContradictionSection (Level 5) is meant to surface side-by-side, not
  // fold into the "shared root cause" framing the others use.
  connections: [
    { a: "demo-belief-0", b: "demo-belief-1", note: "Both beliefs seem to share the same underlying idea — that following a proven path is what's safe." },
    { a: "demo-belief-0", b: "demo-belief-2", note: "Prioritizing safety also seems to extend into avoiding the risk of relying on others." },
    { a: "demo-belief-0", b: "demo-belief-3", note: "The pattern of waiting until you're certain seems to connect to an underlying belief that puts off starting altogether." },
    { a: "demo-belief-0", b: "demo-belief-4", type: "contradiction", note: "You say freedom matters to you, but your actual choices seem to lean toward safety." },
    { a: "demo-belief-1", b: "demo-belief-3", note: "It looks like the fear of putting in effort and still not being recognized leads to delaying until things feel perfect." },
  ],

  // Each entry's `analysis` is what powers the emotion-distribution chart in
  // the Analysis tab's deeper-look section — without these, Demo Mode
  // would show an empty chart even though the feature exists.
  history: [
    {
      id: "demo-entry-0", date: "2026.07.28", text: "Got a job offer, but I feel like I want to wait and see a bit longer...", duration: "4 min 12 sec",
      analysis: {
        observation: {
          situation: "Received a job offer",
          automaticThought: "It's safer to wait and see before deciding",
          emotions: [{ label: "Anxiety", intensity: 58 }, { label: "Anticipation", intensity: 34 }],
          actionUrge: "Puts off the decision and waits a little longer",
        },
        interpretation: {
          possibleCognitivePatterns: ["Should statements"],
          valueDirection: { relatedValues: ["Security"], towardOrAway: "toward", explanation: "This choice moved in the direction of protecting security." },
        },
        hypothesis: {
          candidateBelief: "When things are uncertain, waiting is the safest option",
          confidence: 78, status: "supported",
          supportingEntryIds: ["demo-entry-0"], contradictoryEntryIds: [],
          reasoningSummary: "A pattern of delaying decisions has come up repeatedly.",
        },
      },
    },
    {
      id: "demo-entry-1", date: "2026.07.25", text: "After the presentation, I kept replaying only the parts I regretted...", duration: "2 min 40 sec",
      analysis: {
        observation: {
          situation: "Finished a presentation",
          automaticThought: "I should have prepared more",
          emotions: [{ label: "Regret", intensity: 62 }, { label: "Self-blame", intensity: 45 }],
          actionUrge: "Keeps dwelling on what went wrong rather than what went well",
        },
        interpretation: {
          possibleCognitivePatterns: ["Mental filtering"],
          valueDirection: { relatedValues: ["Growth"], towardOrAway: "away", explanation: "Focusing on the mistake made it hard to see what went well." },
        },
        hypothesis: {
          candidateBelief: "When my results aren't recognized, I blame myself for not trying hard enough",
          confidence: 64, status: "supported",
          supportingEntryIds: ["demo-entry-1"], contradictoryEntryIds: [],
          reasoningSummary: "There's a recurring pattern of looking inward for the cause whenever the outcome isn't good.",
        },
      },
    },
    {
      id: "demo-entry-2", date: "2026.07.21", text: "Lately I can't tell if deciding things alone is actually comfortable, or if I'm just used to it...", duration: "6 min 5 sec",
      analysis: {
        observation: {
          situation: "Reflected on deciding things alone",
          automaticThought: "I'm not sure if this is comfort or just habit",
          emotions: [{ label: "Confusion", intensity: 50 }, { label: "Loneliness", intensity: 30 }],
          actionUrge: "Puts off the answer and keeps asking myself the same question",
        },
        interpretation: {
          possibleCognitivePatterns: ["Jumping to conclusions"],
          valueDirection: { relatedValues: ["Connection"], towardOrAway: "unclear", explanation: "It's still not clear whether being alone or being with others is the direction you actually want." },
        },
        hypothesis: {
          candidateBelief: "It's better to do things alone",
          confidence: 57, status: "emerging",
          supportingEntryIds: ["demo-entry-2"], contradictoryEntryIds: [],
          reasoningSummary: "There have been cases of choosing to be alone without distinguishing comfort from habit.",
        },
      },
    },
  ],

  hypotheses: [
    {
      id: "demo-hyp-0",
      title: "Whenever uncertainty comes up, there's a tendency to automatically interpret waiting as the safest choice.",
      thoughtLabel: "Waiting thought",
      // The closing line is the whole point of this screen, almost verbatim
      // from the product brief's own example — the AI never states a
      // verdict ("this is a bad habit for you"), it hands the
      // interpretation back.
      question: "This pattern has shown up repeatedly in your career, relationships, and investing. Do you think this underlying interpretation is helping you, or holding you back?",
      confidence: 78,
      domains: ["Career", "Relationships", "Investing"],
      reaction: null,
      createdDate: "2026.07.02",
      // The investigate walkthrough below already names these two beliefs
      // as connected ("also seems connected to the underlying belief that
      // you can only start once it's perfect") — wired here so the
      // related-active-neurons and conflicting-entries sections have
      // something real to show, not an empty section.
      relatedBeliefIds: ["demo-belief-0", "demo-belief-3"],
      evidence: [
        { date: "2026.07.02", quote: "I got the offer, but I want to wait and see a bit longer. I'm still not sure." },
        { date: "2026.06.14", quote: "I thought about reaching out to them first, but decided to wait a bit longer." },
        { date: "2026.05.28", quote: "It feels too high to get in right now, so I'll buy once there's a pullback." },
      ],
      investigate: {
        origin: { date: "2025.11.19", quote: "For now, I think it's best to watch the situation a bit longer before deciding." },
        originNote: "This phrase first showed up 8 months ago. Back then it was just once, but now it's repeating across three areas.",
        compareLabel1: "The reason given back then",
        compareSteps1: ["\"a bit longer\"", "\"once I'm sure\""],
        compareLabel2: "8 months later, the actual outcome",
        compareSteps2: ["Delayed the decision", "3 opportunities passed"],
        related: "This \"waiting\" pattern also seems connected to the underlying belief that you can only start once it's perfect — the moment of certainty may never actually arrive.",
      },
    },
    {
      id: "demo-hyp-1",
      title: "When results go unrecognized, there's a pattern of blaming yourself for not trying hard enough.",
      thoughtLabel: "Self-blame thought",
      question: "This interpretation has shown up the same way every time a result disappointed you — presentations, promotions, even relationships. Was it really a lack of effort every time, or is this just a familiar explanation?",
      confidence: 64,
      domains: ["Career", "Self"],
      reaction: null,
      createdDate: "2026.06.30",
      relatedBeliefIds: ["demo-belief-1"],
      evidence: [
        { date: "2026.06.30", quote: "The presentation must not have gone well. I should have prepared more." },
        { date: "2026.05.10", quote: "Not getting the promotion makes me think I'm still not good enough." },
      ],
      investigate: {
        origin: { date: "2026.01.14", quote: "That time was probably because I didn't try hard enough too, I guess." },
        originNote: "Since the start of this year, expressions that look inward for the cause before looking outward have shown up more than 5 times.",
        compareLabel1: "What was actually in your control",
        compareSteps1: ["Prep time", "Presentation content"],
        compareLabel2: "What you're blaming",
        compareSteps2: ["Your whole ability", "\"I'm not good enough\""],
        related: "This pairs with the underlying belief that hard work eventually gets recognized — when recognition doesn't come, it seems to turn into doubting your worth itself, not just your effort.",
      },
    },
    {
      id: "demo-hyp-2",
      title: "You say \"freedom matters to me,\" but your actual choices keep prioritizing stability instead.",
      thoughtLabel: "Freedom-vs-security conflict thought",
      question: "This gap between the value you state and the choices you actually make has shown up three times in a row. Is freedom really what you want, or is it closer to a story you'd like to believe?",
      confidence: 52,
      domains: ["Values", "Decisions"],
      reaction: null,
      createdDate: "2026.07.10",
      relatedBeliefIds: ["demo-belief-0", "demo-belief-4"],
      evidence: [
        { date: "2026.07.10", quote: "You said you wanted to freelance, but you picked the full-time offer again this time." },
        { date: "2026.04.22", quote: "I keep saying I want to live freely. But it'd be a waste to pass up this stable position." },
      ],
      investigate: {
        origin: { date: "2025.09.02", quote: "Someday I want to work freely." },
        originNote: "The wish that started with \"someday\" 10 months ago has led toward stability every time an actual fork in the road came up.",
        compareLabel1: "The value stated",
        compareSteps1: ["Freedom", "\"someday\""],
        compareLabel2: "The actual choice at the fork",
        compareSteps2: ["Full-time job", "\"this time too\""],
        related: "The underlying belief that \"safety comes first\" appears to be operating more strongly than \"freedom\" in practice.",
      },
    },
  ],

  aspiration: null,
  aspirationSetDate: null,
  // Shown only while no aspiration is set, explicitly framed in-copy as
  // examples — real users see none of this once they set an aspiration,
  // and see no aspirationExamples at all since real Store objects never
  // populate this field.
  aspirationExamples: [
    {
      said: "I want to be someone who chooses challenge over safety.",
      saidDate: "2026.02.03",
      label: "Frequency of choosing challenge",
      target: 100,
      actual: 34,
      note: "Over the past 6 months, you actually picked the \"riskier choice\" only 34% of the time. The rest of the time, you went with the safer option.",
    },
    {
      said: "I want to be someone who expresses my feelings more honestly.",
      saidDate: "2026.03.18",
      label: "Share of conversations where you spoke up first",
      target: 100,
      actual: 41,
      note: "In conversations where there was conflict in a relationship, you were the one to express your feelings first 41% of the time.",
    },
    {
      said: "I want to be someone who starts even when things aren't perfect.",
      saidDate: "2026.01.22",
      label: "Share of times you put it off with \"I'll do it once I'm ready\"",
      target: 0,
      actual: 58,
      note: "58% of conversations that mentioned trying something new ended with \"once I'm a bit more ready.\"",
    },
  ],
  driftNotes: [],
  settings: { dailyReminder: true, dailyReminderTime: "20:00", newHypothesisAlert: true, weeklySummary: false },
  account: null,
  entryCount: 47,
  // Demo Mode exists to showcase the full feature set, including everything
  // gated behind Pro (belief map, hypotheses, distance from your goal) —
  // never itself gated.
  isPro: true,
  proPlan: "yearly",
  // Curated, not live-computed (same reasoning as aspirationExamples above)
  // — goalsBeliefSnapshot matches beliefs.length so HomeGoalsWidget sees
  // "already computed for this belief set" and never fires a real API call
  // against demo content.
  goals: [
    {
      id: "demo-goal-0",
      statement: "Let one thing stay imperfect on purpose, and start it anyway.",
      basedOnDomains: ["Work", "Career"],
      createdDate: "2026.07.20",
    },
    {
      id: "demo-goal-1",
      statement: "Ask for help with something before you've exhausted doing it alone.",
      basedOnDomains: ["Relationships"],
      createdDate: "2026.07.20",
    },
    {
      id: "demo-goal-2",
      statement: "Notice one choice this week you made for freedom, not just security.",
      basedOnDomains: ["Values", "Life overall"],
      createdDate: "2026.07.20",
    },
  ],
  goalsBeliefSnapshot: 5,
};
