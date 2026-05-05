import fs from "fs";
import path from "path";

let _logoBase64: string | null = null;

export function getLogoBase64(): string {
  if (_logoBase64) return _logoBase64;

  // Try multiple strategies: from root, from cwd, from source/dist locations
  const cwd = process.cwd();
  const candidates = [
    // When running from project root (unified server, npm run dev:root)
    path.join(cwd, "roka-front", "src", "assets", "image.png"),
    // When running from roka-backend directory
    path.join(cwd, "..", "roka-front", "src", "assets", "image.png"),
    // From __dirname (works if dist is symlinked or if __dirname resolves correctly)
    path.resolve(__dirname, "..", "..", "roka-front", "src", "assets", "image.png"),
    path.resolve(__dirname, "../../..", "roka-front", "src", "assets", "image.png"),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        _logoBase64 = buf.toString("base64");
        return _logoBase64;
      }
    } catch {}
  }
  return "";
}
