import fs from "fs";
import path from "path";

let _logoBase64: string | null = null;

export function getLogoBase64(): string {
  if (_logoBase64) return _logoBase64;

  const candidates = [
    path.resolve(__dirname, "..", "..", "roka-front", "src", "assets", "image.png"),
    path.resolve(__dirname, "..", "..", "..", "roka-front", "src", "assets", "image.png"),
    path.resolve(process.cwd(), "roka-front", "src", "assets", "image.png"),
    path.resolve(process.cwd(), "..", "roka-front", "src", "assets", "image.png"),
  ];

  for (const p of candidates) {
    try {
      const buf = fs.readFileSync(p);
      _logoBase64 = buf.toString("base64");
      return _logoBase64;
    } catch {}
  }
  return "";
}
