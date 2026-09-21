import { LibrusConfigError } from "./errors/index.js";
import { InfoResource } from "./resources/info.js";
import { GatewaySession } from "./session.js";
import type { LibrusClientOptions, LibrusCredentials } from "./types/index.js";

export class LibrusClient {
  readonly info: InfoResource;
  private readonly session: GatewaySession;

  constructor(
    login?: string,
    password?: string,
    options: LibrusClientOptions = {}
  ) {
    const credentials = resolveCredentials(login, password);
    this.session = new GatewaySession(credentials, options);
    this.info = new InfoResource(this.session);
  }

  login(): Promise<void> {
    return this.session.login();
  }
}

function resolveCredentials(
  login?: string | null,
  password?: string | null
): LibrusCredentials {
  const trimmedLogin = typeof login === "string" ? login.trim() : "";
  const hasPassword = typeof password === "string" && password !== "";

  if (!trimmedLogin && !hasPassword) {
    throw new LibrusConfigError(
      'Missing Librus login and password. Pass them as new LibrusClient("login", "password"), or set LIBRUS_LOGIN and LIBRUS_PASSWORD.'
    );
  }
  if (!trimmedLogin) {
    throw new LibrusConfigError(
      'Missing Librus login. Pass it as new LibrusClient("login", "password"), or set LIBRUS_LOGIN.'
    );
  }
  if (!hasPassword) {
    throw new LibrusConfigError(
      'Missing Librus password. Pass it as new LibrusClient("login", "password"), or set LIBRUS_PASSWORD.'
    );
  }

  return { login: trimmedLogin, password };
}
