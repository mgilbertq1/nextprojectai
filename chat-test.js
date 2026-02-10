import fs from "fs";

const BASE_URL = "http://localhost:3000";
const COOKIE_FILE = "cookies.txt";

const decoder = new TextDecoder("utf-8");

// ==========================
// LOAD COOKIE
// ==========================
function loadCookie() {
  if (!fs.existsSync(COOKIE_FILE)) {
    console.error("cookies.txt not found. Login first.");
    process.exit(1);
  }

  const text = fs.readFileSync(COOKIE_FILE, "utf8");
  const match = text.match(/access_token\s+(.+)/);

  if (!match) {
    console.error("access_token not found in cookies.txt");
    process.exit(1);
  }

  return `access_token=${match[1].trim()}`;
}

// ==========================
// SEND MESSAGE (REAL SSE)
// ==========================
async function sendMessage(message) {
  const res = await fetch(`${BASE_URL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: loadCookie(),
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok || !res.body) {
    console.error("ERROR:", await res.text());
    return;
  }

  let buffer = "";

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);

      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5);

      if (payload.trim() === "end") {
        process.stdout.write("\n\nYou > ");
        return;
      }

      process.stdout.write(payload);
    }
  }
}

// ==========================
// RAW STDIN LOOP
// ==========================
process.stdout.write("Chat tester started.\nYou > ");

process.stdin.setEncoding("utf8");
process.stdin.on("data", async (data) => {
  const msg = data.trim();
  if (!msg) {
    process.stdout.write("You > ");
    return;
  }

  if (msg === "/exit") {
    process.exit(0);
  }

  process.stdout.write("\n");
  await sendMessage(msg);
});
