import assert from "node:assert/strict";
import {
  PHASE1_CONVERSATION_STATUSES,
  PHASE1_INBOX_FILTERS,
  isConversationStatus,
  isInboxFilter,
} from "../../lib/conversations/models.ts";

try {
  assert.deepEqual(PHASE1_CONVERSATION_STATUSES, ["new", "open", "pending", "closed"]);
  assert.deepEqual(PHASE1_INBOX_FILTERS, ["all", "unread", "assigned_to_me"]);

  assert.equal(isConversationStatus("open"), true);
  assert.equal(isConversationStatus("archived"), false);

  assert.equal(isInboxFilter("all"), true);
  assert.equal(isInboxFilter("assigned_to_me"), true);
  assert.equal(isInboxFilter("mine"), false);

  console.log("PH1-05 helper checks passed.");
} catch (error) {
  console.error("PH1-05 helper checks failed.");
  throw error;
}
