import { DeepgramSTT } from "@livekit/agents-plugin-deepgram";
import { OpenAILLM } from "@livekit/agents-plugin-openai";
import { OpenAITTS } from "@livekit/agents-plugin-openai";
import { ElevenLabsTTS } from "@livekit/agents-plugin-elevenlabs";

// ============================================
// TTS FallbackAdapter
// ============================================

/**
 * Wraps multiple TTS providers with automatic failover.
 * Tries the primary provider first; if it throws, falls back to the next.
 *
 * This mirrors the Python SDK's FallbackAdapter pattern.
 * TODO: Replace with the official FallbackAdapter when available
 * in the @livekit/agents Node.js SDK.
 */
class TtsFallback {
  private providers: Array<{ name: string; tts: any }>;
  private currentIndex = 0;
  private failedUntil: Map<number, number> = new Map();
  private readonly cooldownMs = 60_000; // retry failed provider after 1 min

  constructor(providers: Array<{ name: string; tts: any }>) {
    this.providers = providers;
  }

  /**
   * Delegates to the first healthy provider.
   * If it fails, marks it unhealthy and tries the next one.
   */
  synthesize(text: string) {
    const now = Date.now();

    // Find first healthy provider
    for (let i = 0; i < this.providers.length; i++) {
      const idx = (this.currentIndex + i) % this.providers.length;
      const failedAt = this.failedUntil.get(idx);

      if (failedAt && now < failedAt) continue; // still in cooldown
      if (failedAt && now >= failedAt) this.failedUntil.delete(idx); // cooldown expired

      try {
        const result = this.providers[idx].tts.synthesize(text);
        this.currentIndex = idx;
        return result;
      } catch (err) {
        console.error(
          `[tts-fallback] ${this.providers[idx].name} failed, trying next:`,
          err
        );
        this.failedUntil.set(idx, now + this.cooldownMs);
      }
    }

    // All providers failed — try primary as last resort
    console.error("[tts-fallback] All TTS providers failed, forcing primary");
    return this.providers[0].tts.synthesize(text);
  }

  // Proxy common properties that VoicePipelineAgent may access
  get sampleRate() {
    return this.providers[this.currentIndex]?.tts.sampleRate ?? 24000;
  }

  get numChannels() {
    return this.providers[this.currentIndex]?.tts.numChannels ?? 1;
  }
}

// ============================================
// Pipeline factory
// ============================================

/**
 * Creates the voice pipeline components for the phone agent.
 *
 * - STT: Deepgram Nova-2, French language
 * - LLM: OpenAI GPT-4o-mini (fast + cost-effective)
 * - TTS: ElevenLabs Turbo v2.5 (primary) → OpenAI TTS-1 (fallback)
 *
 * TODO: Verify exact constructor signatures against @livekit/agents-plugin-* SDK versions.
 */
export function createVoicePipeline() {
  const language = process.env.AGENT_LANGUAGE ?? "fr";
  const voiceId = process.env.AGENT_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";
  const fallbackVoice = process.env.AGENT_FALLBACK_VOICE ?? "nova"; // OpenAI voice

  // -- STT: Deepgram Nova-2 (best French accuracy)
  // TODO: Verify DeepgramSTT constructor options match SDK version
  const stt = new DeepgramSTT({
    model: "nova-2",
    language,
  });

  // -- LLM: GPT-4o-mini (fast, low-latency, cost-effective for conversation)
  // TODO: Verify OpenAILLM constructor options match SDK version
  const llm = new OpenAILLM({
    model: "gpt-4o-mini",
  });

  // -- TTS: ElevenLabs (primary) with OpenAI TTS fallback
  const elevenLabsTts = new ElevenLabsTTS({
    voiceId,
    modelId: "eleven_turbo_v2_5", // lowest latency (~75ms)
  });

  const openAiTts = new OpenAITTS({
    model: "tts-1",
    voice: fallbackVoice,
  });

  const tts = new TtsFallback([
    { name: "ElevenLabs", tts: elevenLabsTts },
    { name: "OpenAI TTS", tts: openAiTts },
  ]);

  console.log("[pipeline] STT: Deepgram Nova-2 (fr)");
  console.log(`[pipeline] LLM: GPT-4o-mini`);
  console.log(`[pipeline] TTS: ElevenLabs Turbo v2.5 (voice: ${voiceId}) → fallback: OpenAI TTS-1 (${fallbackVoice})`);

  return { stt, llm, tts };
}
