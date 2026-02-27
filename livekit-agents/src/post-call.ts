import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase.js";

interface TranscriptEntry {
  speaker: string;
  content: string;
  timestamp_ms: number;
}

interface PostCallAnalysis {
  summary: string;
  category: string;
  sentiment: "positive" | "neutral" | "negative";
  action_items: string[];
  callback_needed: boolean;
}

const anthropic = new Anthropic();

/**
 * Runs post-call AI analysis on the full transcript using Claude.
 *
 * 1. Fetches call_categories from Supabase for the establishment
 * 2. Sends transcript + categories to Claude for structured analysis
 * 3. Updates the call_logs row with summary, category_id, sentiment,
 *    action_items (as [{text, completed: false}]), and callback_needed
 */
export async function postCallProcessing(
  callLogId: string,
  transcript: TranscriptEntry[]
): Promise<void> {
  const establishmentId = process.env.ESTABLISHMENT_ID;
  if (!establishmentId) {
    console.error("[post-call] Missing ESTABLISHMENT_ID env var, skipping analysis");
    return;
  }

  // 1. Fetch categories for this establishment
  const { data: categories, error: catError } = await supabase
    .from("call_categories")
    .select("id, name")
    .eq("establishment_id", establishmentId);

  if (catError) {
    console.error("[post-call] Error fetching categories:", catError.message);
    return;
  }

  const categoryNames = (categories ?? []).map((c) => c.name);

  // 2. Format transcript for the prompt
  const formattedTranscript = transcript
    .map(
      (entry) =>
        `[${Math.round(entry.timestamp_ms / 1000)}s] ${entry.speaker}: ${entry.content}`
    )
    .join("\n");

  // 3. Call Claude for structured analysis
  const systemPrompt = `Tu es un assistant d'analyse post-appel pour un refuge animalier.
Analyse la transcription d'appel telephonique et retourne un JSON avec exactement ces champs :
- "summary": resume de 2-3 phrases en francais
- "category": une des categories suivantes : ${JSON.stringify(categoryNames)}
- "sentiment": "positive", "neutral" ou "negative"
- "action_items": tableau de chaines en francais (actions a effectuer suite a l'appel)
- "callback_needed": boolean (true si l'appelant doit etre rappele)

Reponds UNIQUEMENT avec le JSON, sans markdown ni texte supplementaire.`;

  let analysis: PostCallAnalysis;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Voici la transcription de l'appel :\n\n${formattedTranscript}`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      console.error("[post-call] No text response from Claude");
      return;
    }

    analysis = JSON.parse(textContent.text) as PostCallAnalysis;
  } catch (err) {
    console.error("[post-call] Error calling Claude or parsing response:", err);
    return;
  }

  // 4. Resolve category name to category_id
  let categoryId: string | null = null;
  if (analysis.category && categories) {
    const matched = categories.find(
      (c) => c.name.toLowerCase() === analysis.category.toLowerCase()
    );
    categoryId = matched?.id ?? null;
  }

  // 5. Format action_items as [{text, completed: false}]
  const actionItems = (analysis.action_items ?? []).map((text) => ({
    text,
    completed: false,
  }));

  // 6. Update call_logs with analysis results
  const { error: updateError } = await supabase
    .from("call_logs")
    .update({
      summary: analysis.summary,
      category_id: categoryId,
      sentiment: analysis.sentiment,
      action_items: actionItems,
      callback_needed: analysis.callback_needed,
    })
    .eq("id", callLogId);

  if (updateError) {
    console.error("[post-call] Error updating call_log:", updateError.message);
  } else {
    console.log(`[post-call] Analysis saved for call ${callLogId}`);
  }
}
