import { loginGateway } from "./auth/index.js";
import { createHttpClient, type HttpClient } from "./http/index.js";
import type {
  LibrusClientOptions,
  LibrusCredentials,
  QueryParams,
} from "./types/index.js";

export class GatewaySession {
  private readonly credentials: LibrusCredentials;
  private readonly http: HttpClient;
  private session: Promise<void> | undefined;

  constructor(
    credentials: LibrusCredentials,
    options: LibrusClientOptions = {}
  ) {
    this.credentials = credentials;
    this.http = createHttpClient(options);
  }

  get(path: string, query?: QueryParams): Promise<unknown> {
    return this.ensureSession().then(() => this.http.getJson(path, query));
  }

  login(): Promise<void> {
    return this.ensureSession();
  }

  private ensureSession(): Promise<void> {
    if (!this.session) {
      this.session = loginGateway(this.http, this.credentials).catch(
        (error: unknown) => {
          this.session = undefined;
          throw error;
        }
      );
    }
    return this.session;
  }
}
