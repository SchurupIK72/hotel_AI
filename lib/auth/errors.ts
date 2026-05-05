export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
    Object.setPrototypeOf(this, AuthenticationRequiredError.prototype);
  }
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "AuthorizationError";
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export function isAuthenticationRequiredError(error: unknown) {
  return (
    error instanceof AuthenticationRequiredError ||
    (error instanceof Error && error.name === "AuthenticationRequiredError")
  );
}

export function isAuthorizationError(error: unknown) {
  return error instanceof AuthorizationError || (error instanceof Error && error.name === "AuthorizationError");
}

export function isMissingAuthSessionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    error.name === "AuthSessionMissingError" ||
    message.includes("auth session missing") ||
    message.includes("user from sub claim in jwt does not exist")
  );
}
