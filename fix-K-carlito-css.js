const fs = require("fs")

const filePath = "src\\renderer\\src\\assets\\main.css"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `@import "tailwindcss";
@source "../../node_modules/pptx-vue-viewer/dist";`

const count = content.split(anchor).length - 1
console.log("ancora K1: encontrada " + count + "x")
if (count !== 1) {
  console.error("Abortado: ancora K1 nao encontrada exatamente 1x.")
  process.exit(1)
}

const replacement = `@import "tailwindcss";
@source "../../node_modules/pptx-vue-viewer/dist";

@font-face {
  font-family: 'Carlito';
  src: url('./fonts/carlito/Carlito-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Carlito';
  src: url('./fonts/carlito/Carlito-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Carlito';
  src: url('./fonts/carlito/Carlito-Italic.ttf') format('truetype');
  font-weight: 400;
  font-style: italic;
  font-display: block;
}
@font-face {
  font-family: 'Carlito';
  src: url('./fonts/carlito/Carlito-BoldItalic.ttf') format('truetype');
  font-weight: 700;
  font-style: italic;
  font-display: block;
}`

content = content.replace(anchor, replacement)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: main.css atualizado.")
