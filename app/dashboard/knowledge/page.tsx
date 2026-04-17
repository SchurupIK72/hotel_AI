import { KnowledgeManagement } from "@/components/knowledge/management";
import {
  createFaqItemAction,
  createPolicyItemAction,
  deleteFaqItemAction,
  deletePolicyItemAction,
  setFaqItemPublishedAction,
  setPolicyItemPublishedAction,
  updateFaqItemAction,
  updatePolicyItemAction,
} from "@/app/dashboard/knowledge/actions";
import { requireHotelAdmin } from "@/lib/auth/guards";
import { listActiveHotelUsersByHotelId } from "@/lib/db/hotel-users";
import { listFaqItems, listPolicyItems } from "@/lib/knowledge/store";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type KnowledgePageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function KnowledgePage({ searchParams }: KnowledgePageProps) {
  const access = await requireHotelAdmin();
  const params = (await searchParams) ?? {};
  const supabase = await createServerSupabaseClient();
  const [faqItems, policyItems, hotelUsers] = await Promise.all([
    listFaqItems(access.hotelId),
    listPolicyItems(access.hotelId),
    listActiveHotelUsersByHotelId(supabase, access.hotelId),
  ]);
  const hotelUserNames = Object.fromEntries(
    hotelUsers.map((user) => [user.id, user.full_name?.trim() || user.id] as const),
  );

  return (
    <KnowledgeManagement
      createFaqItemAction={createFaqItemAction}
      createPolicyItemAction={createPolicyItemAction}
      deleteFaqItemAction={deleteFaqItemAction}
      deletePolicyItemAction={deletePolicyItemAction}
      faqItems={faqItems}
      flashMessage={params.message ?? null}
      flashStatus={params.status === "error" ? "error" : params.status === "saved" ? "saved" : null}
      hotelUserNames={hotelUserNames}
      policyItems={policyItems}
      setFaqItemPublishedAction={setFaqItemPublishedAction}
      setPolicyItemPublishedAction={setPolicyItemPublishedAction}
      updateFaqItemAction={updateFaqItemAction}
      updatePolicyItemAction={updatePolicyItemAction}
    />
  );
}
