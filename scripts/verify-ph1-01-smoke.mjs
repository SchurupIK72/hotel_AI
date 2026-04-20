import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = process.cwd();
const envPath = path.join(repoRoot, ".env.local");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, "utf8");
  const result = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function requireEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createServiceClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createAnonClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function getOrCreateUser(adminClient, { email, password, fullName }) {
  const { data: listed, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError) {
    throw listError;
  }

  const existingUser = listed.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );

  if (existingUser) {
    const { data: updatedData, error: updateError } =
      await adminClient.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (updateError) {
      throw updateError;
    }

    return updatedData.user;
  }

  const { data: createdData, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

  if (createError) {
    throw createError;
  }

  return createdData.user;
}

async function upsertHotel(adminClient, hotel) {
  const { error } = await adminClient.from("hotels").upsert(hotel, {
    onConflict: "id",
  });

  if (error) {
    throw error;
  }
}

async function upsertMembership(adminClient, membership) {
  const { error } = await adminClient.from("hotel_users").upsert(membership, {
    onConflict: "hotel_id,auth_user_id",
  });

  if (error) {
    throw error;
  }
}

async function signIn(url, anonKey, email, password) {
  const client = createAnonClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return client;
}

async function assertAdminRls(client, expectedHotelId, foreignHotelId) {
  const { data: hotelUsers, error: hotelUsersError } = await client
    .from("hotel_users")
    .select("auth_user_id, hotel_id, role")
    .order("role", { ascending: true });

  if (hotelUsersError) {
    throw hotelUsersError;
  }

  if (!hotelUsers || hotelUsers.length < 2) {
    throw new Error("Expected hotel_admin to read at least two staff rows for their hotel.");
  }

  if (hotelUsers.some((row) => row.hotel_id !== expectedHotelId)) {
    throw new Error("hotel_admin RLS leaked a membership row from another hotel.");
  }

  if (hotelUsers.some((row) => row.hotel_id === foreignHotelId)) {
    throw new Error("hotel_admin can read a foreign-hotel membership row.");
  }

  const { data: hotels, error: hotelsError } = await client
    .from("hotels")
    .select("id, slug")
    .order("slug", { ascending: true });

  if (hotelsError) {
    throw hotelsError;
  }

  if (!hotels || hotels.length !== 1 || hotels[0].id !== expectedHotelId) {
    throw new Error("hotel_admin should only read the active hotel row.");
  }
}

async function assertManagerRls(client, expectedHotelId, expectedAuthUserId) {
  const { data: hotelUsers, error: hotelUsersError } = await client
    .from("hotel_users")
    .select("auth_user_id, hotel_id, role");

  if (hotelUsersError) {
    throw hotelUsersError;
  }

  if (!hotelUsers || hotelUsers.length !== 1) {
    throw new Error("manager should only read their own membership row.");
  }

  const [membership] = hotelUsers;
  if (
    membership.hotel_id !== expectedHotelId ||
    membership.auth_user_id !== expectedAuthUserId
  ) {
    throw new Error("manager membership query returned the wrong tenant-scoped row.");
  }

  const { data: hotels, error: hotelsError } = await client
    .from("hotels")
    .select("id, slug");

  if (hotelsError) {
    throw hotelsError;
  }

  if (!hotels || hotels.length !== 1 || hotels[0].id !== expectedHotelId) {
    throw new Error("manager should only read the active hotel row.");
  }
}

async function verifyDashboardRedirect() {
  try {
    const response = await fetch("http://127.0.0.1:3000/dashboard", {
      redirect: "manual",
    });

    const location = response.headers.get("location");
    if (
      ![303, 307, 308].includes(response.status) ||
      !location?.includes("/sign-in")
    ) {
      throw new Error(
        `Expected unauthenticated /dashboard request to redirect to /sign-in, got ${response.status} ${location ?? ""}`.trim(),
      );
    }
  } catch (error) {
    const causeCode =
      error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object"
        ? error.cause.code
        : null;
    if (
      (error instanceof Error && error.message.includes("ECONNREFUSED")) ||
      causeCode === "ECONNREFUSED"
    ) {
      console.warn(
        "Skipped /dashboard redirect smoke check because the Next.js dev server is not running on http://127.0.0.1:3000.",
      );
      return;
    }

    throw error;
  }
}

async function main() {
  const env = {
    ...parseEnvFile(envPath),
    ...process.env,
  };

  const supabaseUrl = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const adminPassword = env.DEMO_ADMIN_PASSWORD ?? "DemoPass123!";
  const managerPassword = "DemoManager123!";
  const otherManagerPassword = "OtherManager123!";
  const primaryHotelId = env.DEMO_HOTEL_ID ?? "11111111-1111-1111-1111-111111111111";
  const primaryHotelSlug = env.DEMO_HOTEL_SLUG ?? "demo-hotel";
  const adminEmail = env.DEMO_ADMIN_EMAIL ?? "demo-admin@hotel.local";

  const otherHotelId = "22222222-2222-2222-2222-222222222222";
  const otherHotelSlug = "other-demo-hotel";
  const managerEmail = "demo-manager@hotel.local";
  const otherManagerEmail = "other-manager@hotel.local";

  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

  await upsertHotel(adminClient, {
    id: primaryHotelId,
    name: env.DEMO_HOTEL_NAME ?? "Demo Hotel",
    slug: primaryHotelSlug,
    default_language: "en",
    timezone: "Europe/Moscow",
  });
  await upsertHotel(adminClient, {
    id: otherHotelId,
    name: "Other Demo Hotel",
    slug: otherHotelSlug,
    default_language: "en",
    timezone: "Europe/Moscow",
  });

  const adminUser = await getOrCreateUser(adminClient, {
    email: adminEmail,
    password: adminPassword,
    fullName: env.DEMO_ADMIN_FULL_NAME ?? "Demo Hotel Admin",
  });
  const managerUser = await getOrCreateUser(adminClient, {
    email: managerEmail,
    password: managerPassword,
    fullName: "Demo Hotel Manager",
  });
  const otherManagerUser = await getOrCreateUser(adminClient, {
    email: otherManagerEmail,
    password: otherManagerPassword,
    fullName: "Other Hotel Manager",
  });

  await upsertMembership(adminClient, {
    hotel_id: primaryHotelId,
    auth_user_id: adminUser.id,
    role: "hotel_admin",
    full_name: env.DEMO_ADMIN_FULL_NAME ?? "Demo Hotel Admin",
    is_active: true,
  });
  await upsertMembership(adminClient, {
    hotel_id: primaryHotelId,
    auth_user_id: managerUser.id,
    role: "manager",
    full_name: "Demo Hotel Manager",
    is_active: true,
  });
  await upsertMembership(adminClient, {
    hotel_id: otherHotelId,
    auth_user_id: otherManagerUser.id,
    role: "manager",
    full_name: "Other Hotel Manager",
    is_active: true,
  });

  const adminSessionClient = await signIn(
    supabaseUrl,
    anonKey,
    adminEmail,
    adminPassword,
  );
  await assertAdminRls(adminSessionClient, primaryHotelId, otherHotelId);

  const managerSessionClient = await signIn(
    supabaseUrl,
    anonKey,
    managerEmail,
    managerPassword,
  );
  await assertManagerRls(managerSessionClient, primaryHotelId, managerUser.id);

  const otherManagerSessionClient = await signIn(
    supabaseUrl,
    anonKey,
    otherManagerEmail,
    otherManagerPassword,
  );
  await assertManagerRls(otherManagerSessionClient, otherHotelId, otherManagerUser.id);

  await verifyDashboardRedirect();

  console.log("PH1-01 smoke verification passed.");
  console.log(`hotel_admin can read same-hotel staff rows for ${primaryHotelSlug}.`);
  console.log("manager visibility stays limited to their own hotel membership.");
  console.log("Unauthenticated /dashboard requests redirect to /sign-in when the app is running.");
}

main().catch((error) => {
  console.error("PH1-01 smoke verification failed.");
  console.error(error);
  process.exit(1);
});
