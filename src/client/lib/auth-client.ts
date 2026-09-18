import { createAuthClient } from "better-auth/react";

// 同一 Worker で /api/auth/* を配信しているので baseURL の指定は不要。
export const authClient = createAuthClient();
