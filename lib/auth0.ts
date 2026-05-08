import {
  Auth0Client,
  filterDefaultIdTokenClaims,
} from "@auth0/nextjs-auth0/server";

import { pickRoleClaimsFromIdToken } from "@/lib/sessionRoles";

const authorizationParameters: Record<string, string> = {};

const audience =
  process.env.AUTH0_AUDIENCE?.trim() ||
  process.env.COLORCENTER_API_IDENTIFIER?.trim();
if (audience) {
  authorizationParameters.audience = audience;
}

const organization = process.env.AUTH0_ORGANIZATION?.trim();
if (organization) {
  authorizationParameters.organization = organization;
}

/**
 * Por defecto el SDK solo persiste claims “estándar” del ID token y descarta el resto,
 * así que los roles en claims custom nunca llegaban a `getSession()`.
 */
export const auth0 = new Auth0Client({
  ...(Object.keys(authorizationParameters).length > 0
    ? { authorizationParameters }
    : {}),
  /** Evita `console.warn` del SDK sobre RP-initiated logout en cada `/auth/logout`. */
  logoutStrategy: "v2",
  beforeSessionSaved: async (session) => {
    const claims = session.user as Record<string, unknown>;
    return {
      ...session,
      user: {
        ...filterDefaultIdTokenClaims(claims),
        ...pickRoleClaimsFromIdToken(claims),
      },
    };
  },
});
