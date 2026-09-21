import { LibrusAuthError } from "../errors/index.js";
import { isRedirect, type HttpClient } from "../http/index.js";
import type { LibrusCredentials } from "../types/index.js";
import { makeBannerHeader } from "./banner.js";

const PORTAL_RODZINA_PATH = "/loguj/portalRodzina";
const TOKEN_INFO_PATH = "/Auth/TokenInfo";

/**
 * Browser-equivalent Synergia OAuth login. The resulting
 * cookies authenticate Gateway API 2.0 JSON reads
 */
export async function loginGateway(
  http: HttpClient,
  credentials: LibrusCredentials
): Promise<void> {
  const portalUrl = `${http.synergiaBaseUrl}${PORTAL_RODZINA_PATH}?v=${
    Date.now() / 1000
  }`;
  const start = await getAuthPage(http, portalUrl, "https://portal.librus.pl/");
  const authorizationUrl = safeAuthorizationUrl(
    requireLocation(start, portalUrl)
  );

  const authPage = await getAuthPage(http, authorizationUrl, portalUrl);
  const loginUrl = safeAuthorizationUrl(
    requireLocation(authPage, authorizationUrl)
  );
  await getAuthPage(http, loginUrl, authorizationUrl);

  const loginResponse = await http.fetch(loginUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      "x-baner": makeBannerHeader(),
      "x-requested-with": "XMLHttpRequest",
      accept: "application/json, text/javascript, */*; q=0.01",
      origin: http.authBaseUrl,
      referer: loginUrl,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      action: "login",
      login: credentials.login,
      pass: credentials.password,
    }),
  });

  if (loginResponse.status >= 400) {
    throw new LibrusAuthError(
      `Librus login failed with HTTP ${loginResponse.status}.`
    );
  }

  const nextTarget =
    loginResponse.headers.get("location") ?? (await readGoTo(loginResponse));
  if (!nextTarget) {
    throw new LibrusAuthError(
      "Librus login did not provide a continuation URL."
    );
  }

  await followAuthorizationChain(http, nextTarget, loginUrl);
  await verifyGatewaySession(http);
}

async function getAuthPage(
  http: HttpClient,
  url: string,
  referer?: string
): Promise<Response> {
  const response = await http.fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: referer ? { referer } : undefined,
  });
  if (response.status >= 400) {
    throw new LibrusAuthError(
      `Librus authorization request failed with HTTP ${response.status}.`
    );
  }
  return response;
}

async function followAuthorizationChain(
  http: HttpClient,
  value: string,
  referer: string
): Promise<void> {
  let nextUrl = safeAuthorizationUrl(value, referer, true);
  for (let hop = 0; hop < 10; hop += 1) {
    const response = await getAuthPage(http, nextUrl, referer);
    const location = response.headers.get("location");
    if (!isRedirect(response.status) || !location) {
      return;
    }
    referer = nextUrl;
    nextUrl = safeAuthorizationUrl(location, nextUrl, true);
  }
  throw new LibrusAuthError(
    "Librus authorization exceeded the redirect limit."
  );
}

async function verifyGatewaySession(http: HttpClient): Promise<void> {
  try {
    await http.getJson(TOKEN_INFO_PATH);
  } catch (error) {
    throw new LibrusAuthError(
      "Librus login did not establish a Gateway API 2.0 session.",
      { cause: error }
    );
  }
}

async function readGoTo(response: Response): Promise<string | undefined> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    return undefined;
  }
  try {
    const payload = (await response.json()) as { goTo?: unknown };
    return typeof payload.goTo === "string" ? payload.goTo : undefined;
  } catch {
    return undefined;
  }
}

function requireLocation(response: Response, base: string): string {
  const location = response.headers.get("location");
  if (!location) {
    throw new LibrusAuthError(
      "Librus authorization response had no redirect location."
    );
  }
  return new URL(location, base).toString();
}

function safeAuthorizationUrl(
  value: string,
  base = "https://api.librus.pl",
  allowSynergia = false
): string {
  const url = new URL(value, base);
  const apiAuthorization =
    url.hostname === "api.librus.pl" &&
    (url.pathname === "/OAuth/Authorization" ||
      url.pathname.startsWith("/OAuth/Authorization/"));
  const synergiaLogin =
    allowSynergia &&
    url.hostname === "synergia.librus.pl" &&
    (url.pathname === "/loguj/portalRodzina" ||
      url.pathname.startsWith("/loguj/portalRodzina/"));
  const valid =
    url.protocol === "https:" &&
    (!url.port || url.port === "443") &&
    !url.username &&
    !url.password &&
    (apiAuthorization || synergiaLogin);
  if (!valid) {
    throw new LibrusAuthError("Unexpected Librus authorization URL.");
  }
  return url.toString();
}
