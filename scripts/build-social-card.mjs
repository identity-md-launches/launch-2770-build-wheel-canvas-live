/** Regenerate the local 1200×630 social image using the site's renderer and fonts. */
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import ts from "typescript";

const renderer = ts.transpileModule(await readFile("src/lib/art.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const font = async (name) => (await readFile(`public/fonts/${name}.woff2`)).toString("base64");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setContent(`<style>
    @font-face { font-family: 'DM Sans'; font-weight: 400; src: url(data:font/woff2;base64,${await font("dm-sans-latin-400-normal")}); }
    @font-face { font-family: 'DM Sans'; font-weight: 600; src: url(data:font/woff2;base64,${await font("dm-sans-latin-600-normal")}); }
    @font-face { font-family: Silkscreen; src: url(data:font/woff2;base64,${await font("silkscreen-latin-400-normal")}); }
  </style>`);
  const png = await page.evaluate(async (code) => {
    const { paintArt } = await import(`data:text/javascript;base64,${code}`);
    await Promise.all([
      document.fonts.load('400 24px "DM Sans"'),
      document.fonts.load('600 64px "DM Sans"'),
      document.fonts.load('400 18px Silkscreen'),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#101112";
    ctx.fillRect(0, 0, 1200, 630);
    const wheel = document.createElement("canvas");
    wheel.width = 650;
    wheel.height = 630;
    // Completed Oct 29 noon-to-noon bucket from the public 30-day API, read Oct 31.
    const bucket = {
      startAt: "2026-10-29T12:00:00.000Z", endAt: "2026-10-30T12:00:00.000Z",
      work: 13297, blocks: 1141, settlements: 144,
    };
    paintArt(wheel.getContext("2d"), 650, 630, {
      date: "2026-10-29", buckets: [bucket], firstHeight: 2994, lastHeight: 4135,
      work: bucket.work, blocks: bucket.blocks, source: "daily",
      intervalStart: bucket.startAt, intervalEnd: bucket.endAt, signers: null,
    });
    ctx.drawImage(wheel, 550, 0);
    ctx.fillStyle = "#f6b65b";
    ctx.font = '400 18px Silkscreen, monospace';
    ctx.fillText("Wheel Canvas", 64, 116);
    ctx.fillStyle = "#b5afa5";
    ctx.font = '400 20px "DM Sans", sans-serif';
    ctx.fillText("built on Squeekchain", 64, 154);
    ctx.fillStyle = "#f4ede3";
    ctx.font = '600 64px "DM Sans", sans-serif';
    ctx.fillText("A little wheel.", 64, 260);
    ctx.fillStyle = "#f6b65b";
    ctx.fillText("Endless art.", 64, 340);
    ctx.fillStyle = "#b5afa5";
    ctx.font = '400 24px "DM Sans", sans-serif';
    ctx.fillText("Painted by Squeektoshi.", 64, 424);
    ctx.fillText("Signed by all of us.", 64, 460);
    ctx.font = '400 18px "DM Sans", sans-serif';
    ctx.fillText("Independent community artwork · Sepolia testnet", 64, 562);
    return canvas.toDataURL("image/png").split(",")[1];
  }, Buffer.from(renderer).toString("base64"));
  await writeFile("public/social-card.png", Buffer.from(png, "base64"));
  console.log("Created public/social-card.png (1200×630), built on Squeekchain.");
} finally {
  await browser.close();
}
