import type { ZodType } from "zod";

import { LibrusParseError } from "../errors/index.js";
import type { GatewaySession } from "../session.js";
import type { QueryParams } from "../types/index.js";

/** Base for `client.info` and future resources (`client.grades`, …). */
export abstract class Resource {
  constructor(protected readonly session: GatewaySession) {}

  protected async get<T>(
    path: string,
    schema: ZodType<T>,
    query?: QueryParams
  ): Promise<T> {
    const payload = await this.session.get(path, query);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new LibrusParseError(
        `Librus API response for ${path} did not match the expected shape.`,
        { cause: parsed.error }
      );
    }
    return parsed.data;
  }
}
