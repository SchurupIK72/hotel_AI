import { createServiceRoleSupabaseClient } from "../supabase/admin.ts";
import type { Json } from "../../types/database.ts";
import { compactAuditPayload, isPhase1AuditEventType } from "./catalog.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value: string | null | undefined) {
  return value && UUID_PATTERN.test(value) ? value : null;
}

export async function createEventLog(input: {
  hotelId?: string | null;
  integrationId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Json;
}) {
  if (!isPhase1AuditEventType(input.eventType)) {
    throw new Error(`Unsupported Phase 1 audit event type: ${input.eventType}`);
  }

  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("event_logs").insert({
    hotel_id: input.hotelId ?? null,
    integration_id: normalizeUuid(input.integrationId),
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    payload:
      input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
        ? compactAuditPayload(input.payload as Record<string, Json | undefined>)
        : (input.payload ?? {}),
  } as never);

  if (error) {
    throw error;
  }
}

export async function createEventLogSafely(input: {
  hotelId?: string | null;
  integrationId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Json;
}) {
  try {
    await createEventLog(input);
  } catch (error) {
    console.error("event_log_write_failed", {
      eventType: input.eventType,
      hotelId: input.hotelId ?? null,
      integrationId: normalizeUuid(input.integrationId),
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
