import { ADDITIONAL_QUOTES } from './additionalQuotes.ts';

export const DAILY_QUOTES = [
  { portrait: "anais-nin", text: "We don't see things as they are, we see them as we are.", author: "Anaïs Nin" },
  { portrait: "jung-becoming", text: "The privilege of a lifetime is to become who you truly are.", author: "Carl Jung" },
  { portrait: "epictetus", text: "No man is free who is not master of himself.", author: "Epictetus" },
  { portrait: "kierkegaard", text: "Life can only be understood backwards; but it must be lived forwards.", author: "Søren Kierkegaard" },
  { portrait: "rumi-quiet", text: "The quieter you become, the more you are able to hear.", author: "Rumi" },
  { portrait: "rumi-seeking", text: "What you seek is seeking you.", author: "Rumi" },
  { portrait: "virginia-woolf", text: "I am rooted, but I flow.", author: "Virginia Woolf" },
  { portrait: "jung-darkness", text: "One does not become enlightened by imagining figures of light, but by making the darkness conscious.", author: "Carl Jung" },
  { portrait: "carl-rogers", text: "The curious paradox is that when I accept myself just as I am, then I can change.", author: "Carl Rogers" },
  { portrait: "jung-heart", text: "Your vision will become clear only when you can look into your own heart.", author: "Carl Jung" },
  { portrait: "rilke", text: "The only journey is the one within.", author: "Rainer Maria Rilke" },
  { portrait: "maya-angelou", text: "There is no greater agony than bearing an untold story inside you.", author: "Maya Angelou" },
  ...ADDITIONAL_QUOTES,
] as const;

type OpeningQuote = typeof DAILY_QUOTES[number];
let openingQuote: OpeningQuote | undefined;

/** One random author per app launch; avoid the author shown on the last launch. */
export function getOpeningQuote(): OpeningQuote {
  if (openingQuote) return openingQuote;
  const key = "mindscape.lastOpeningQuoteAuthor";
  let previousAuthor: string | null = null;
  try { previousAuthor = localStorage.getItem(key); } catch { /* Storage is optional. */ }
  const authors = [...new Set(DAILY_QUOTES.map(quote => quote.author))];
  const candidates = authors.filter(author => author !== previousAuthor);
  const author = candidates[Math.floor(Math.random() * candidates.length)];
  const quotes = DAILY_QUOTES.filter(quote => quote.author === author);
  openingQuote = quotes[Math.floor(Math.random() * quotes.length)];
  try { localStorage.setItem(key, openingQuote.author); } catch { /* Still works privately. */ }
  return openingQuote;
}
