import { loadLookBank } from './bank';
import { resolveRecommendations, type RecommendationRequest } from './resolve-recommendations';

self.addEventListener('message', async (event: MessageEvent<RecommendationRequest>) => {
  const bankReady = await loadLookBank();
  if (!bankReady) {
    self.postMessage(null);
    return;
  }
  self.postMessage(resolveRecommendations(event.data, bankReady));
});
