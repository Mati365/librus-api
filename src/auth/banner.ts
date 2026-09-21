/**
 * Librus expects x-baner to contain a random value and timestamp whose
 * characters are shifted by 20 Unicode code points, matching its browser client.
 */
export function makeBannerHeader(): string {
  return `${shiftCharacters(String(Math.random()))}_${shiftCharacters(
    String(Date.now())
  )}`;
}

function shiftCharacters(value: string): string {
  return value
    .split("")
    .map((character) => String.fromCharCode(character.charCodeAt(0) + 20))
    .join("");
}
