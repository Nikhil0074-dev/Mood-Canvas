import type { Emotion, TextMood } from '../types';

export const EMOTIONS: Emotion[] = ['calm', 'happy', 'sad', 'energetic', 'dreamy', 'mysterious', 'focused'];

const LEXICON: Record<Emotion, string[]> = {
  calm: ['calm', 'peaceful', 'relax', 'relaxing', 'soft', 'quiet', 'gentle', 'serene', 'still', 'slow', 'rest'],
  happy: ['happy', 'joy', 'bright', 'sunny', 'warm', 'smile', 'love', 'fun', 'cheerful', 'good', 'glad'],
  sad: ['sad', 'lonely', 'cry', 'grief', 'miss', 'tired', 'empty', 'loss', 'blue', 'hurt', 'forget'],
  energetic: ['energy', 'energetic', 'fast', 'power', 'run', 'excited', 'wild', 'intense', 'dance', 'drive', 'loud'],
  dreamy: ['dream', 'dreamy', 'float', 'floating', 'cloud', 'sleep', 'hazy', 'magic', 'stars', 'drift'],
  mysterious: ['mystery', 'mysterious', 'shadow', 'unknown', 'secret', 'night', 'fog', 'strange', 'hidden', 'ghost'],
  focused: ['focus', 'focused', 'study', 'work', 'concentrate', 'clear', 'steady', 'precise', 'flow', 'productive'],
};
const POSITIVE: Emotion[] = ['happy', 'calm', 'energetic'];
const NEGATIVE: Emotion[] = ['sad', 'mysterious'];

/** Simple, explainable keyword scoring. Treat the result as a hint, not a verdict. */
export function analyzeText(text: string): TextMood {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const scores = Object.fromEntries(EMOTIONS.map((e) => [e, 0])) as Record<Emotion, number>;
  const keywords: string[] = [];
  words.forEach((w, i) => {
    const negated = ['not', "don't", 'no', 'never'].includes(words[i - 1] ?? '');
    for (const e of EMOTIONS) {
      if (LEXICON[e].includes(w)) {
        scores[e] += negated ? -0.5 : 1;
        if (!negated && !keywords.includes(w)) keywords.push(w);
      }
    }
  });
  for (const e of EMOTIONS) scores[e] = Math.max(0, scores[e]);
  const total = EMOTIONS.reduce((s, e) => s + scores[e], 0);
  if (total === 0) return { emotion: null, sentiment: 0, intensity: 0, confidence: 0, keywords, scores };
  const emotion = EMOTIONS.reduce((a, b) => (scores[b] > scores[a] ? b : a));
  const pos = POSITIVE.reduce((s, e) => s + scores[e], 0);
  const neg = NEGATIVE.reduce((s, e) => s + scores[e], 0);
  return {
    emotion,
    sentiment: (pos - neg) / total,
    intensity: Math.min(1, total / 4),
    confidence: (scores[emotion] / total) * Math.min(1, total / 3),
    keywords,
    scores,
  };
}
