import {
  type JobContext,
  // TODO: Verify these imports match the actual @livekit/agents SDK exports
} from "@livekit/agents";
import { VoicePipelineAgent } from "@livekit/agents";
import { supabase } from "./supabase.js";
import { createVoicePipeline } from "./voice-pipeline.js";
import { postCallProcessing } from "./post-call.js";

interface TranscriptEntry {
  speaker: string;
  content: string;
  timestamp_ms: number;
}

const SYSTEM_PROMPT = `Tu es l'assistant telephonique IA du refuge animalier SDA Estormel.

ROLE : Tu reponds aux appels entrants du refuge. Tu es chaleureux, empathique et professionnel. Tu parles comme un(e) employe(e) du refuge, pas comme un robot.

REGLES :
- Reponds en francais, de maniere naturelle et concise (2-3 phrases max par reponse).
- Commence toujours par "Bonjour, refuge SDA Estormel, comment puis-je vous aider ?"
- Ecoute attentivement et reformule si necessaire pour confirmer ta comprehension.
- Si l'appelant est emotif (animal perdu, blessure), sois rassurant et empathique.

TU PEUX AIDER AVEC :
- Adoptions : horaires de visite, procedure d'adoption, animaux disponibles.
- Animaux perdus ou trouves : prendre les details (espece, race, couleur, lieu, date, contact).
- Dons : comment faire un don, recu fiscal.
- Informations generales : horaires d'ouverture, adresse, benevoles.
- Rendez-vous : prise de rendez-vous veterinaire, visite d'adoption.
- Reclamations : noter la plainte et assurer un suivi.

TU NE DOIS PAS :
- Donner de diagnostics veterinaires.
- Promettre la disponibilite d'un animal specifique.
- Donner des informations personnelles sur le personnel.
- Inventer des informations que tu ne connais pas — dis plutot "Je vais noter votre demande et un membre de l'equipe vous rappellera".

Si tu ne peux pas repondre a une question, propose de prendre le numero de l'appelant pour qu'on le rappelle.`;

/**
 * Main agent entry point, invoked by the LiveKit Agents framework
 * when a new room/call is assigned to this worker.
 *
 * TODO: The @livekit/agents Node.js SDK API is evolving — verify method
 * signatures and event names against the installed version.
 */
export async function entrypoint(ctx: JobContext): Promise<void> {
  const establishmentId = process.env.ESTABLISHMENT_ID;
  const agentName = process.env.AGENT_NAME ?? "Refuge Agent";

  if (!establishmentId) {
    console.error("[agent] Missing ESTABLISHMENT_ID env var");
    return;
  }

  // Transcript buffer for post-call analysis
  const transcript: TranscriptEntry[] = [];
  let callLogId: string | null = null;
  let callStartTime: number | null = null;

  try {
    // ------------------------------------------------------------------
    // 1. Extract caller info from room metadata or name
    // ------------------------------------------------------------------
    // TODO: Verify how to access room metadata in the SDK.
    // The room name or metadata may contain the caller's phone number.
    const room = ctx.room;
    const callerPhone = room.name ?? "unknown";

    // ------------------------------------------------------------------
    // 2. Create call_log entry (status: ringing)
    // ------------------------------------------------------------------
    const { data: callLog, error: callLogError } = await supabase
      .from("call_logs")
      .insert({
        establishment_id: establishmentId,
        caller_phone: callerPhone,
        status: "ringing",
        agent_name: agentName,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (callLogError || !callLog) {
      console.error("[agent] Failed to create call_log:", callLogError?.message);
      return;
    }

    callLogId = callLog.id;
    console.log(`[agent] Call log created: ${callLogId}`);

    // ------------------------------------------------------------------
    // 3. Upsert agent_session (status: in_call)
    // ------------------------------------------------------------------
    const { error: sessionError } = await supabase
      .from("agent_sessions")
      .upsert(
        {
          establishment_id: establishmentId,
          agent_name: agentName,
          status: "in_call",
          current_call_id: callLogId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "establishment_id,agent_name",
        }
      );

    if (sessionError) {
      console.error("[agent] Failed to upsert agent_session:", sessionError.message);
    }

    // ------------------------------------------------------------------
    // 4. Connect to room, update call_log to in_progress
    // ------------------------------------------------------------------
    // TODO: Verify ctx.connect() is the correct method name in this SDK version
    await ctx.connect();
    callStartTime = Date.now();

    await supabase
      .from("call_logs")
      .update({ status: "in_progress" })
      .eq("id", callLogId);

    console.log(`[agent] Connected to room, call in progress: ${callLogId}`);

    // ------------------------------------------------------------------
    // 5. Create voice pipeline and start the VoicePipelineAgent
    // ------------------------------------------------------------------
    const { stt, llm, tts } = createVoicePipeline();

    // TODO: Verify VoicePipelineAgent constructor signature
    const agent = new VoicePipelineAgent(stt, llm, tts, {
      chatCtx: {
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
        ],
      },
    });

    // ------------------------------------------------------------------
    // 6. Track speech events and insert call_transcripts in real-time
    // ------------------------------------------------------------------

    // TODO: Verify event names — these may be "user_speech_committed" /
    // "agent_speech_committed" or similar depending on SDK version
    agent.on("user_speech_committed", async (event: { text: string }) => {
      const timestampMs = Date.now() - (callStartTime ?? Date.now());
      transcript.push({
        speaker: "caller",
        content: event.text,
        timestamp_ms: timestampMs,
      });

      // Insert transcript entry in real-time
      const { error } = await supabase.from("call_transcripts").insert({
        call_log_id: callLogId,
        speaker: "caller",
        content: event.text,
        timestamp_ms: timestampMs,
      });

      if (error) {
        console.error("[agent] Failed to insert caller transcript:", error.message);
      }
    });

    agent.on("agent_speech_committed", async (event: { text: string }) => {
      const timestampMs = Date.now() - (callStartTime ?? Date.now());
      transcript.push({
        speaker: "agent",
        content: event.text,
        timestamp_ms: timestampMs,
      });

      // Insert transcript entry in real-time
      const { error } = await supabase.from("call_transcripts").insert({
        call_log_id: callLogId,
        speaker: "agent",
        content: event.text,
        timestamp_ms: timestampMs,
      });

      if (error) {
        console.error("[agent] Failed to insert agent transcript:", error.message);
      }
    });

    // TODO: Verify the method to start the agent in the room
    agent.start(room);

    // ------------------------------------------------------------------
    // 7. Wait for the call to end
    // ------------------------------------------------------------------
    // TODO: Verify disconnection event or awaitable pattern
    await new Promise<void>((resolve) => {
      ctx.room.on("disconnected", () => {
        resolve();
      });
    });
  } catch (err) {
    console.error("[agent] Unhandled error during call:", err);
  } finally {
    // ------------------------------------------------------------------
    // 8. Call ended — update call_log (completed, duration, ended_at)
    // ------------------------------------------------------------------
    const endedAt = new Date().toISOString();
    const durationSeconds = callStartTime
      ? Math.round((Date.now() - callStartTime) / 1000)
      : 0;

    if (callLogId) {
      await supabase
        .from("call_logs")
        .update({
          status: "completed",
          ended_at: endedAt,
          duration_seconds: durationSeconds,
        })
        .eq("id", callLogId);

      console.log(`[agent] Call completed: ${callLogId} (${durationSeconds}s)`);

      // ------------------------------------------------------------------
      // 9. Set agent_session to processing, run post-call analysis
      // ------------------------------------------------------------------
      await supabase
        .from("agent_sessions")
        .update({
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("establishment_id", establishmentId)
        .eq("agent_name", agentName);

      if (transcript.length > 0) {
        console.log(`[agent] Running post-call analysis (${transcript.length} entries)...`);
        await postCallProcessing(callLogId, transcript);
      } else {
        console.log("[agent] No transcript entries, skipping post-call analysis");
      }
    }

    // ------------------------------------------------------------------
    // 10. Set agent_session back to idle
    // ------------------------------------------------------------------
    await supabase
      .from("agent_sessions")
      .update({
        status: "idle",
        current_call_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("establishment_id", establishmentId)
      .eq("agent_name", agentName);

    console.log("[agent] Agent session back to idle");
  }
}
