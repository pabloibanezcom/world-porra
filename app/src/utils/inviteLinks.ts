const INVITE_CODE_PATTERN = /^[A-Z0-9]{6,8}$/u;
const DEFAULT_APP_URL = 'https://app.worldporra.com';

export interface ParsedInviteLink {
  code: string;
  leagueName: string | null;
}

export function normalizeInviteCode(value: string | null | undefined): string | null {
  const code = value?.trim().replace(/[^a-z0-9]/gi, '').toUpperCase() ?? '';
  return INVITE_CODE_PATTERN.test(code) ? code : null;
}

export function normalizeInviteLeagueName(value: string | null | undefined): string | null {
  const name = value?.trim().replace(/\s+/gu, ' ') ?? '';
  return name.length > 0 ? name.slice(0, 80) : null;
}

export function getAppBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/u, '');
}

export function buildInviteUrl(inviteCode: string, leagueName?: string): string {
  const code = normalizeInviteCode(inviteCode);
  const url = new URL(`${getAppBaseUrl()}/join/${code ?? inviteCode.trim().toUpperCase()}`);
  const normalizedLeagueName = normalizeInviteLeagueName(leagueName);
  if (normalizedLeagueName) {
    url.searchParams.set('league', normalizedLeagueName);
  }
  return url.toString();
}

export function parseInviteFromUrl(url: string | null | undefined): ParsedInviteLink | null {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    const joinIndex = pathParts.findIndex((part) => part.toLowerCase() === 'join');
    const pathCode = joinIndex >= 0 ? pathParts[joinIndex + 1] : null;
    const schemeCode = parsedUrl.hostname.toLowerCase() === 'join' ? pathParts[0] : null;
    const code =
      normalizeInviteCode(pathCode) ??
      normalizeInviteCode(schemeCode) ??
      normalizeInviteCode(parsedUrl.searchParams.get('invite')) ??
      normalizeInviteCode(parsedUrl.searchParams.get('code'));

    if (!code) return null;

    return {
      code,
      leagueName: normalizeInviteLeagueName(parsedUrl.searchParams.get('league')),
    };
  } catch {
    const match = url.match(/(?:^|\/)join\/([a-z0-9]{6,8})(?:[/?#]|$)/iu);
    const code = normalizeInviteCode(match?.[1]);
    return code ? { code, leagueName: null } : null;
  }
}

export function parseInviteCodeFromUrl(url: string | null | undefined): string | null {
  return parseInviteFromUrl(url)?.code ?? null;
}
