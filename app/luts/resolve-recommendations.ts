import { rankFromInspiration, type InspirationBoard } from './inspiration';
import { fallbackOptions, rankPixelData, type RecommendationPixels } from './recommend';

export type RecommendationRequest = {
  source: RecommendationPixels;
  reference: RecommendationPixels | null;
  boards: InspirationBoard[] | null;
  pinned: string | null;
};

export function resolveRecommendations(request: RecommendationRequest, bankReady: boolean) {
  const { source, reference, boards, pinned } = request;
  if (bankReady && boards && !reference) return rankFromInspiration(source, boards, pinned);
  const result = bankReady ? rankPixelData(source, reference) : { options: fallbackOptions, close: false };
  return { ...result, match: null, adaptive: false };
}
