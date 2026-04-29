import * as esbuild from "esbuild";

const external = ["pg", "pg-native"];

// Bundle app.ts (createRokaApp + all routes + middleware + utilities)
await esbuild.build({
  entryPoints: ["src/app.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/app.js",
  external,
  sourcemap: true,
});

// Bundle migrations.ts (standalone for index.cjs)
await esbuild.build({
  entryPoints: ["src/lib/migrations.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/lib/migrations.js",
  external,
  sourcemap: true,
});

console.log("Build completado → dist/app.js + dist/lib/migrations.js");
