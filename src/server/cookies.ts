/** Format identik dengan hasil Export JSON ekstensi Cookie-Editor. */
export interface EditorCookie {
  domain: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: "no_restriction" | "lax" | "strict" | "unspecified";
  secure: boolean;
  session: boolean;
  storeId: string;
  value: string;
}
