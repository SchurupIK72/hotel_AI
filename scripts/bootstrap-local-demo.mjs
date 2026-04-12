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

const env = {
  ...parseEnvFile(envPath),
  ...process.env,
};

function requireEnv(name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const demoHotelId = env.DEMO_HOTEL_ID ?? "11111111-1111-1111-1111-111111111111";
const demoHotelName = env.DEMO_HOTEL_NAME ?? "Demo Hotel";
const demoHotelSlug = env.DEMO_HOTEL_SLUG ?? "demo-hotel";
const demoAdminEmail = env.DEMO_ADMIN_EMAIL ?? "demo-admin@hotel.local";
const demoAdminPassword = env.DEMO_ADMIN_PASSWORD ?? "DemoPass123!";
const demoAdminFullName = env.DEMO_ADMIN_FULL_NAME ?? "Demo Hotel Admin";

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function getOrCreateDemoUser() {
  const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError) {
    throw listError;
  }

  const existingUser = existingUsers.users.find(
    (user) => user.email?.toLowerCase() === demoAdminEmail.toLowerCase(),
  );

  if (existingUser) {
    return existingUser;
  }

  const { data: createdUserData, error: createError } =
    await adminClient.auth.admin.createUser({
      email: demoAdminEmail,
      password: demoAdminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: demoAdminFullName,
      },
    });

  if (createError) {
    throw createError;
  }

  return createdUserData.user;
}

async function upsertDemoHotel() {
  const { error } = await adminClient.from("hotels").upsert(
    {
      id: demoHotelId,
      name: demoHotelName,
      slug: demoHotelSlug,
      default_language: "en",
      timezone: "Europe/Moscow",
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

async function upsertHotelMembership(authUserId) {
  const { error } = await adminClient.from("hotel_users").upsert(
    {
      hotel_id: demoHotelId,
      auth_user_id: authUserId,
      role: "hotel_admin",
      full_name: demoAdminFullName,
      is_active: true,
    },
    { onConflict: "hotel_id,auth_user_id" },
  );

  if (error) {
    throw error;
  }
}

async function main() {
  await upsertDemoHotel();
  const demoUser = await getOrCreateDemoUser();
  await upsertHotelMembership(demoUser.id);

  console.log("Local demo bootstrap completed.");
  console.log(`Hotel: ${demoHotelName} (${demoHotelId})`);
  console.log(`User: ${demoAdminEmail}`);
  console.log("Password:", demoAdminPassword);
}

main().catch((error) => {
  console.error("Failed to bootstrap local demo data.");
  console.error(error);
  process.exit(1);
});
