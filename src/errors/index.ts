export class LibrusError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LibrusError";
    this.code = code;
  }
}

export class LibrusConfigError extends LibrusError {
  constructor(message: string) {
    super("CONFIG", message);
    this.name = "LibrusConfigError";
  }
}

export class LibrusAuthError extends LibrusError {
  constructor(message: string, options?: ErrorOptions) {
    super("AUTH", message, options);
    this.name = "LibrusAuthError";
  }
}

export class LibrusApiError extends LibrusError {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super("API", message);
    this.name = "LibrusApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export class LibrusParseError extends LibrusError {
  constructor(message: string, options?: ErrorOptions) {
    super("PARSE", message, options);
    this.name = "LibrusParseError";
  }
}
