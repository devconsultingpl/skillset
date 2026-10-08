import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import pc from "picocolors";
import { envSessionKey } from "../bridges/index.js";
import { suggestionsFilePath } from "../core/locations.js";

export async function suggest(message: string): Promise<number> {
  const suggestion = message.trim();
  if (suggestion.length === 0) {
    console.error(
      pc.red("error"),
      'suggest: nothing to record — pass "what should change, and why"',
    );
    return 1;
  }

  const session = envSessionKey();
  const entry = {
    at: new Date().toISOString(),
    cwd: process.cwd(),
    ...(session ? { session } : {}),
    suggestion,
  };
  const path = suggestionsFilePath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
  console.log(pc.green("suggested"), pc.dim(path));
  return 0;
}
