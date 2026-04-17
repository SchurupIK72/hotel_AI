import type { KnowledgeListItem } from "@/lib/knowledge/models";

type KnowledgeAction = (formData: FormData) => void | Promise<void>;

type KnowledgeManagementProps = {
  faqItems: KnowledgeListItem[];
  policyItems: KnowledgeListItem[];
  hotelUserNames: Record<string, string>;
  flashMessage?: string | null;
  flashStatus?: "saved" | "error" | null;
  createFaqItemAction: KnowledgeAction;
  updateFaqItemAction: KnowledgeAction;
  deleteFaqItemAction: KnowledgeAction;
  createPolicyItemAction: KnowledgeAction;
  updatePolicyItemAction: KnowledgeAction;
  deletePolicyItemAction: KnowledgeAction;
  setFaqItemPublishedAction: KnowledgeAction;
  setPolicyItemPublishedAction: KnowledgeAction;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not published";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function resolveHotelUserName(hotelUserNames: Record<string, string>, hotelUserId: string) {
  return hotelUserNames[hotelUserId] ?? hotelUserId;
}

function renderKnowledgeCreateForm(
  type: "faq" | "policy",
  actions: Pick<KnowledgeManagementProps, "createFaqItemAction" | "createPolicyItemAction">,
) {
  if (type === "faq") {
    return (
      <form action={actions.createFaqItemAction} className="knowledge-form stack">
        <label className="label-stack">
          <span>Question</span>
          <input className="input" name="question" placeholder="Do you offer breakfast?" required type="text" />
        </label>
        <label className="label-stack">
          <span>Answer</span>
          <textarea className="input knowledge-textarea" name="answer" placeholder="Breakfast is served from 07:00 to 10:30." required />
        </label>
        <button className="button" type="submit">
          Add FAQ item
        </button>
      </form>
    );
  }

  return (
    <form action={actions.createPolicyItemAction} className="knowledge-form stack">
      <label className="label-stack">
        <span>Title</span>
        <input className="input" name="title" placeholder="Late checkout" required type="text" />
      </label>
      <label className="label-stack">
        <span>Policy body</span>
        <textarea className="input knowledge-textarea" name="body" placeholder="Late checkout is subject to availability." required />
      </label>
      <button className="button" type="submit">
        Add policy item
      </button>
    </form>
  );
}

function renderKnowledgeCard(
  item: KnowledgeListItem,
  hotelUserNames: Record<string, string>,
  actions: Pick<
    KnowledgeManagementProps,
    | "updateFaqItemAction"
    | "deleteFaqItemAction"
    | "updatePolicyItemAction"
    | "deletePolicyItemAction"
    | "setFaqItemPublishedAction"
    | "setPolicyItemPublishedAction"
  >,
) {
  const isFaq = item.type === "faq";
  const updateAction = isFaq ? actions.updateFaqItemAction : actions.updatePolicyItemAction;
  const deleteAction = isFaq ? actions.deleteFaqItemAction : actions.deletePolicyItemAction;
  const publishAction = isFaq ? actions.setFaqItemPublishedAction : actions.setPolicyItemPublishedAction;
  const creatorName = resolveHotelUserName(hotelUserNames, item.createdByHotelUserId);
  const editorName = resolveHotelUserName(hotelUserNames, item.updatedByHotelUserId);
  const publishButtonLabel = item.publishState === "published" ? "Move to draft" : "Publish item";
  const governanceCopy =
    item.publishState === "published"
      ? "Approved for later Copilot retrieval."
      : "Draft items stay unavailable to downstream AI retrieval.";

  return (
    <article className="meta-card knowledge-card" key={item.id}>
      <div className="knowledge-card-header">
        <div>
          <p className="eyebrow">{item.type === "faq" ? "FAQ item" : "Policy item"}</p>
          <h2 className="section-title">{item.title}</h2>
        </div>
        <span className={`conversation-pill${item.publishState === "published" ? "" : " knowledge-pill-draft"}`}>
          {item.publishState}
        </span>
      </div>
      <form action={updateAction} className="knowledge-form stack">
        <input name={isFaq ? "faqItemId" : "policyItemId"} type="hidden" value={item.id} />
        <label className="label-stack">
          <span>{isFaq ? "Question" : "Title"}</span>
          <input className="input" defaultValue={item.title} name={isFaq ? "question" : "title"} required type="text" />
        </label>
        <label className="label-stack">
          <span>{isFaq ? "Answer" : "Body"}</span>
          <textarea className="input knowledge-textarea" defaultValue={item.body} name={isFaq ? "answer" : "body"} required />
        </label>
        <div className="knowledge-meta-grid">
          <p className="body-copy mono">Creator: {creatorName}</p>
          <p className="body-copy mono">Last editor: {editorName}</p>
          <p className="body-copy mono">Updated: {formatDateTime(item.updatedAt)}</p>
          <p className="body-copy mono">Published: {formatDateTime(item.publishedAt)}</p>
        </div>
        <p className="body-copy">{governanceCopy}</p>
        <div className="knowledge-action-row">
          <button className="button" type="submit">
            Save changes
          </button>
        </div>
      </form>
      <div className="knowledge-action-row">
        <form action={publishAction}>
          <input name={isFaq ? "faqItemId" : "policyItemId"} type="hidden" value={item.id} />
          <input name="isPublished" type="hidden" value={item.publishState === "published" ? "false" : "true"} />
          <button className="button secondary-button" type="submit">
            {publishButtonLabel}
          </button>
        </form>
        <form action={deleteAction}>
          <input name={isFaq ? "faqItemId" : "policyItemId"} type="hidden" value={item.id} />
          <button className="button secondary-button" type="submit">
            Delete item
          </button>
        </form>
      </div>
    </article>
  );
}

function renderKnowledgeSection(
  type: "faq" | "policy",
  items: KnowledgeListItem[],
  hotelUserNames: Record<string, string>,
  actions: Pick<
    KnowledgeManagementProps,
    | "createFaqItemAction"
    | "updateFaqItemAction"
    | "deleteFaqItemAction"
    | "createPolicyItemAction"
    | "updatePolicyItemAction"
    | "deletePolicyItemAction"
    | "setFaqItemPublishedAction"
    | "setPolicyItemPublishedAction"
  >,
) {
  const isFaq = type === "faq";

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">{isFaq ? "FAQ" : "Policy"}</p>
        <h2 className="section-title">{isFaq ? "Curated guest answers" : "Operational policies"}</h2>
        <p className="body-copy">
          {isFaq
            ? "Maintain short approved answers that later Copilot retrieval can quote safely."
            : "Maintain hotel policies and operational rules that later Copilot flows can reference."}
        </p>
      </div>
      <article className="meta-card stack">{renderKnowledgeCreateForm(type, actions)}</article>
      {items.length === 0 ? (
        <article className="meta-card stack">
          <h3 className="section-title">{isFaq ? "No FAQ items yet" : "No policy items yet"}</h3>
          <p className="body-copy">
            {isFaq
              ? "Add your first approved guest question and answer to start building the hotel knowledge base."
              : "Add your first hotel policy so later retrieval and draft generation can rely on approved guidance."}
          </p>
        </article>
      ) : (
        <div className="knowledge-card-grid">{items.map((item) => renderKnowledgeCard(item, hotelUserNames, actions))}</div>
      )}
    </section>
  );
}

export function KnowledgeManagement({
  faqItems,
  policyItems,
  hotelUserNames,
  flashMessage,
  flashStatus,
  createFaqItemAction,
  updateFaqItemAction,
  deleteFaqItemAction,
  createPolicyItemAction,
  updatePolicyItemAction,
  deletePolicyItemAction,
  setFaqItemPublishedAction,
  setPolicyItemPublishedAction,
}: KnowledgeManagementProps) {
  const actions = {
    createFaqItemAction,
    updateFaqItemAction,
    deleteFaqItemAction,
    createPolicyItemAction,
    updatePolicyItemAction,
    deletePolicyItemAction,
    setFaqItemPublishedAction,
    setPolicyItemPublishedAction,
  };

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">PH1-06</p>
        <h1 className="title">Knowledge base management</h1>
        <p className="body-copy">
          Curate hotel-approved FAQ and policy content so later Copilot retrieval can rely on tenant-safe information instead of freeform recall.
        </p>
      </div>
      {flashStatus && flashMessage ? (
        <article className={`meta-card operation-banner operation-banner-${flashStatus}`}>
          <p className={flashStatus === "error" ? "error-text" : "success-text"}>{flashMessage}</p>
        </article>
      ) : null}
      <div className="knowledge-layout">
        {renderKnowledgeSection("faq", faqItems, hotelUserNames, actions)}
        {renderKnowledgeSection("policy", policyItems, hotelUserNames, actions)}
      </div>
    </section>
  );
}
