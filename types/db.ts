export interface DbUser {
  [key: string]: unknown;

  id: string;
  email: string;
  password_hash: string;
  role: "user" | "admin";
  banned: boolean;
  created_at: string;
}
