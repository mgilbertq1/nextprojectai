// test-resend.ts
import { Resend } from "resend";
import "dotenv/config";

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to:   "daaaphiine@gmail.com",    // ← ganti email kamu
    subject: "Test Resend",
    html: "<p>Koneksi Resend berhasil!</p>",
  });

  console.log("data:", data);
  console.log("error:", error);
}

main();