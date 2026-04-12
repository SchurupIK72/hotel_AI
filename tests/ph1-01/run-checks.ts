import assert from "node:assert/strict";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  isMissingAuthSessionError,
} from "../../lib/auth/errors.ts";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  getSuperAdminEmails,
} from "../../lib/env.ts";

function testAuthenticationErrors() {
  const authError = new AuthenticationRequiredError();
  assert.equal(authError.name, "AuthenticationRequiredError");
  assert.equal(authError.message, "Authentication is required.");

  assert.equal(
    new AuthorizationError().message,
    "You do not have access to this resource.",
  );
  assert.equal(
    new AuthorizationError("Custom denial.").message,
    "Custom denial.",
  );

  assert.equal(
    isMissingAuthSessionError(
      Object.assign(new Error("Auth session missing!"), {
        name: "AuthSessionMissingError",
      }),
    ),
    true,
  );
  assert.equal(
    isMissingAuthSessionError(new Error("User from sub claim in JWT does not exist")),
    true,
  );
  assert.equal(
    isMissingAuthSessionError(new Error("Invalid login credentials")),
    false,
  );
  assert.equal(isMissingAuthSessionError("not-an-error"), false);
}

function testEnvReaders() {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousSuperAdmins = process.env.SUPER_ADMIN_EMAILS;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPER_ADMIN_EMAILS = " Owner@Example.com, ops@example.com ,,";

  try {
    assert.equal(getSupabaseUrl(), "http://127.0.0.1:54321");
    assert.equal(getSupabaseAnonKey(), "test-anon-key");
    assert.deepEqual(getSuperAdminEmails(), [
      "owner@example.com",
      "ops@example.com",
    ]);
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
    process.env.SUPER_ADMIN_EMAILS = previousSuperAdmins;
  }
}

try {
  testAuthenticationErrors();
  testEnvReaders();

  console.log("PH1-01 unit checks passed.");
} catch (error) {
  console.error("PH1-01 unit checks failed.");
  throw error;
}
