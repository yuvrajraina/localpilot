import * as assert from 'node:assert/strict';

import { getRecommendedModelPicks } from '../src/onboarding/modelSetup';
import { ONBOARDING_COMPLETED_KEY } from '../src/onboarding/onboarding';

suite('LocalPilot onboarding', () => {
  test('offers recommended models without requiring automatic pulls', () => {
    const picks = getRecommendedModelPicks();

    assert.deepEqual(
      picks.map((pick) => pick.model ?? 'custom'),
      [
        'qwen2.5-coder:1.5b',
        'qwen2.5-coder:7b',
        'smollm2:360m',
        'deepseek-coder:1.3b',
        'codegemma:2b',
        'custom'
      ]
    );
  });

  test('uses a stable globalState key', () => {
    assert.equal(ONBOARDING_COMPLETED_KEY, 'localpilot.onboardingCompleted');
  });
});
