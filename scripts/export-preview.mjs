import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.resolve(root, process.argv[2] || "dist");
const output = process.argv[3]
  ? path.resolve(root, process.argv[3])
  : path.join(dist, "DailyAPP-previa.html");
const mimeTypes = {
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function assetPath(reference) {
  const relative = reference.replace(/^\/+/, "");
  const resolved = path.resolve(dist, relative);
  if (!resolved.startsWith(dist + path.sep)) {
    throw new Error("Asset fora do build: " + reference);
  }
  return resolved;
}

function dataURL(reference) {
  const filename = assetPath(reference);
  const mime = mimeTypes[path.extname(filename)];
  if (!mime) throw new Error("Formato de asset não suportado: " + reference);
  return (
    "data:" + mime + ";base64," + fs.readFileSync(filename).toString("base64")
  );
}

let scripts = 0;
let styles = 0;
let html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
html = html.replace(
  /<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g,
  (_, reference) => {
    const javascript = fs.readFileSync(assetPath(reference), "utf8");
    scripts += 1;
    return (
      '<script type="module">' +
      javascript.replace(/<\/script/gi, "<\\/script") +
      "</script>"
    );
  },
);
html = html.replace(
  /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g,
  (_, reference) => {
    let css = fs.readFileSync(assetPath(reference), "utf8");
    css = css.replace(/url\(([^)]+)\)/g, (_, value) => {
      const asset = value.trim().replace(/^["']|["']$/g, "");
      if (asset.startsWith("data:")) return "url(" + asset + ")";
      if (/^(?:https?:)?\/\//.test(asset))
        throw new Error("Asset externo: " + asset);
      const relative = asset.startsWith("/")
        ? asset
        : path.posix.join(path.posix.dirname(reference), asset);
      return 'url("' + dataURL(relative) + '")';
    });
    styles += 1;
    return "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>";
  },
);
html = html.replace(
  /(<link\b[^>]*\brel="icon"[^>]*\bhref=")([^"]+)(")/g,
  (_, prefix, reference, suffix) => prefix + dataURL(reference) + suffix,
);
if (scripts !== 1 || styles !== 1) {
  throw new Error(
    "O build deve conter um bundle JavaScript e uma folha de estilos.",
  );
}
if (/(?:src|href)="\/assets\//.test(html)) {
  throw new Error("O arquivo ainda contém referências a assets externos.");
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log("Prévia independente gerada: " + output);
