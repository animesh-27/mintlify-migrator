import fs from "fs-extra";
import path from "path";

// ==========================================
// 1. AUTO-DETECTION (Zero Config)
// ==========================================
const findDir = (folderName) => {
  const commonPaths = [`./${folderName}`, `./input-docusaurus/${folderName}`, `../${folderName}`];
  return commonPaths.find((p) => fs.existsSync(p));
};

const INPUT_DOCS_DIR = findDir("docs");
const INPUT_STATIC_DIR = findDir("static");
const ROOT_DIR = INPUT_DOCS_DIR ? path.join(INPUT_DOCS_DIR, "..") : ".";
const OUTPUT_DIR = "./mintlify-output";

// ==========================================
// 2. SDK CLASSIFIER
// ==========================================
const SDK_CATEGORIES = {
  Web: ["react-web-core", "web-core", "javascript", "html", "web"],
  Mobile: ["android", "android-core", "ios", "ios-core", "flutter", "flutter-core"],
  "React Native": ["react-native", "rn-core", "rn-ui-kit"],
  "UI Kits": ["ui-kit", "react-ui-kit", "angular-ui-kit", "vue"],
};

function getSdkCategory(folderName) {
  const lower = folderName.toLowerCase();
  for (const [category, keywords] of Object.entries(SDK_CATEGORIES)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return "Other SDKs";
}

const ACRONYMS = {
  ai: "AI",
  api: "API",
  ui: "UI",
  sdk: "SDK",
  cli: "CLI",
  ios: "iOS",
  html: "HTML",
  rest: "REST",
  sip: "SIP",
  rtmp: "RTMP",
  stt: "STT",
};

function toTitleCase(s) {
  if (!s) return "";
  return s
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYMS[lower]) return ACRONYMS[lower];
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

// ==========================================
// 3. DOCUSAURUS METADATA & PARSERS
// ==========================================
function getFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx > -1) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  });
  return fm;
}

function getCategoryMeta(dirPath) {
  const catPath = path.join(dirPath, "_category_.json");
  if (fs.existsSync(catPath)) {
    try {
      return JSON.parse(fs.readFileSync(catPath, "utf-8"));
    } catch (e) {}
  }
  return {};
}

function getSortedItems(dirPath) {
  const items = fs.readdirSync(dirPath);
  const processed = items.map((item) => {
    const itemPath = path.join(dirPath, item);
    const isDir = fs.statSync(itemPath).isDirectory();
    let pos = 9999;

    if (item === "index.md" || item === "index.mdx" || item === "README.md" || item === "readme.md") {
      pos = -1;
    } else if (isDir) {
      const meta = getCategoryMeta(itemPath);
      if (meta.position !== undefined) pos = meta.position;
    } else if (item.endsWith(".md") || item.endsWith(".mdx")) {
      try {
        const content = fs.readFileSync(itemPath, "utf-8");
        const fm = getFrontmatter(content);
        if (fm.sidebar_position) pos = parseFloat(fm.sidebar_position);
      } catch (e) {}
    }
    return { item, itemPath, isDir, pos };
  });

  return processed.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    return a.item.localeCompare(b.item);
  });
}

// ==========================================
// 4. STATIC COPY (fix broken images)
// ==========================================
function copyStaticToImages() {
  if (!INPUT_STATIC_DIR) return;
  const outImages = path.join(OUTPUT_DIR, "images");
  fs.ensureDirSync(outImages);

  // copy common static subfolders
  const candidates = ["img", "images", "assets", "public", "static"];
  for (const c of candidates) {
    const src = path.join(INPUT_STATIC_DIR, c);
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      fs.copySync(src, outImages, { overwrite: true });
    }
  }

  // also copy top-level common files if they exist
  const files = ["logo.svg", "logo.png", "favicon.ico", "logo-light.svg", "logo-dark.svg", "logo-light.png", "logo-dark.png"];
  for (const f of files) {
    const src = path.join(INPUT_STATIC_DIR, f);
    if (fs.existsSync(src) && fs.statSync(src).isFile()) {
      fs.copySync(src, path.join(outImages, f), { overwrite: true });
    }
  }
}

// ==========================================
// 5. CONTENT CONVERTER (accordion + images)
// ==========================================
function convertDocusaurusToMintlify(content, baseName, isIndex, groupName) {
  let out = content || "";

  // Strip Docusaurus/React-only imports (prevents empty pages due to MDX parse failures)
  out = out.replace(/^import\s+.*?from\s+['"](@site|@theme|@docusaurus|react-feather|@fluentui)[^'"]*['"]\s*;?\s*\n/gm, "");
  out = out.replace(/^import\s+.*?from\s+['"][^'"]*partials[^'"]*['"]\s*;?\s*\n/gm, "");

  // Comments
  out = out.replace(/<!--([\s\S]*?)-->/g, "{/*$1*/}");

  // Tabs (Docusaurus -> Mintlify)
  out = out.replace(/<Tabs\b[^>]*>/g, "\n\n<Tabs>\n\n");
  out = out.replace(/<\/Tabs>/g, "\n\n</Tabs>\n\n");
  out = out.replace(/<TabItem\b([^>]*)>/g, (match, attrs) => {
    const labelMatch = attrs.match(/label=["']([^"']+)["']/);
    return `\n\n<Tab title="${labelMatch ? labelMatch[1] : "Tab"}">\n\n`;
  });
  out = out.replace(/<\/TabItem>/g, "\n\n</Tab>\n\n");

  // Admonitions
  out = out.replace(/:::(info|note|warning|caution|tip|danger)(?:\s+[^\n]*)?\s*\n([\s\S]*?)\n:::/g, (match, type, body) => {
    const Tag =
      { info: "Info", note: "Note", caution: "Warning", warning: "Warning", tip: "Tip", danger: "Warning" }[
        String(type).toLowerCase()
      ] || "Note";
    return `\n\n<${Tag}>\n\n${body.trim()}\n\n</${Tag}>\n\n`;
  });

  // ---- Images: handle /static/img, /img, /images, relative img/, ./img/, ../static/img etc.
  // Markdown images
  out = out.replace(/!\[([^\]]*)\]\(\s*(?:\.{0,2}\/)?(?:static\/)?(?:img|images|assets)\/([^)]+?)\s*\)/g, "![$1](/images/$2)");
  out = out.replace(/!\[([^\]]*)\]\(\s*\/(?:static\/)?(?:img|images|assets)\/([^)]+?)\s*\)/g, "![$1](/images/$2)");

  // HTML images
  out = out.replace(/<img[^>]+src=["']\s*(?:\.{0,2}\/)?(?:static\/)?(?:img|images|assets)\/([^"']+)["'][^>]*>/g, "![Image](/images/$1)");
  out = out.replace(/<img[^>]+src=["']\s*\/(?:static\/)?(?:img|images|assets)\/([^"']+)["'][^>]*>/g, "![Image](/images/$1)");

  // require(...) images
  out = out.replace(
    /<img[^>]+src=\{require\(['"]\s*(?:\.{0,2}\/)?(?:static\/)?(?:img|images|assets)\/([^"']+)['"]\)\}[^>]*>/g,
    "![Image](/images/$1)"
  );
  out = out.replace(
    /<img[^>]+src=\{require\(['"]\s*\/(?:static\/)?(?:img|images|assets)\/([^"']+)['"]\)\}[^>]*>/g,
    "![Image](/images/$1)"
  );

  // Cards
  out = out.replace(/<CardList[^>]*>/g, "<CardGroup cols={2}>");
  out = out.replace(/<\/CardList>/g, "</CardGroup>");
  // FIX: ensure a space before href
  out = out.replace(/<Card([^>]*)\sto=(["'][^"']+["'])([^>]*)>/g, "<Card$1 href=$2$3>");

  // Escape weird JSX-ish tokens that break MDX sometimes
  out = out.replace(/<([A-Za-z0-9_]*[\[\\][^>]*)>/g, "&lt;$1&gt;");

  // ---------- Title / Frontmatter ----------
  let fmTitle = toTitleCase(baseName);
  if (isIndex) fmTitle = "Overview";

  let hasFm = false;
  const fmMatch = out.match(/^\s*---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (fmMatch) {
    hasFm = true;
    const fm = getFrontmatter(out);
    if (fm.title) fmTitle = fm.title;
    out = out.replace(fmMatch[0], "");
  }

  const h1Match = out.match(/^#\s+(.+)$/m);
  if (h1Match) {
    if (!hasFm) fmTitle = h1Match[1].trim();
    out = out.replace(h1Match[0], "");
  }

  // If folder landing page title duplicates the group name, rename to Overview
  if (isIndex && groupName && fmTitle.toLowerCase() === groupName.toLowerCase()) {
    fmTitle = "Overview";
  }

  out = `---\ntitle: "${String(fmTitle).replace(/"/g, '\\"')}"\n---\n\n` + out.trimStart();
  return out;
}

function writeMdxFile(absInputPath, relDir, fileName, groupName) {
  const baseName = path.basename(fileName, path.extname(fileName));
  const isIndex = baseName.toLowerCase() === "index" || baseName.toLowerCase() === "readme";
  const raw = fs.readFileSync(absInputPath, "utf-8");

  fs.outputFileSync(
    path.join(OUTPUT_DIR, relDir, `${baseName}.mdx`),
    convertDocusaurusToMintlify(raw, baseName, isIndex, groupName)
  );

  return path.join(relDir, baseName).replace(/\\/g, "/").replace(/^\/+/, "");
}

function processDirectoryHierarchy(currentPath, relativePath) {
  const catMeta = getCategoryMeta(currentPath);
  const groupName = catMeta.label || toTitleCase(path.basename(currentPath));

  // ✅ Accordion behavior: keep expanded false everywhere
  const group = { group: groupName, expanded: false, pages: [] };
  const sortedItems = getSortedItems(currentPath);

  for (const { item, itemPath, isDir } of sortedItems) {
    if (item.startsWith(".") || item === "_category_.json") continue;

    if (isDir) {
      const subGroup = processDirectoryHierarchy(itemPath, path.join(relativePath, item));
      if (subGroup.pages.length > 0) group.pages.push(subGroup);
    } else if (item.endsWith(".md") || item.endsWith(".mdx")) {
      group.pages.push(writeMdxFile(itemPath, relativePath, item, groupName));
    }
  }

  return group;
}

// ==========================================
// 6. MAIN EXECUTION
// ==========================================
async function run() {
  console.log("🚀 Zero-Config Docusaurus -> Mintlify Migrator\n");

  if (!INPUT_DOCS_DIR) {
    console.error("❌ Error: Could not automatically detect a Docusaurus 'docs' directory.");
    console.error("Please ensure you are running this in the project root.");
    process.exit(1);
  }

  console.log(`✅ Detected Docusaurus docs at: ${INPUT_DOCS_DIR}`);

  fs.emptyDirSync(OUTPUT_DIR);
  copyStaticToImages();

  // Auto-Fetch Configs
  let projectName = "Documentation";
  let hexColor = "#2160fd";
  let logoPath = "";

  const configPath = path.join(ROOT_DIR, "docusaurus.config.js");
  if (fs.existsSync(configPath)) {
    const configRaw = fs.readFileSync(configPath, "utf8");
    const titleMatch = configRaw.match(/title:\s*['"](.*?)['"]/);
    if (titleMatch) projectName = titleMatch[1];
  }

  const cssPath = path.join(ROOT_DIR, "src/css/custom.css");
  if (fs.existsSync(cssPath)) {
    const cssRaw = fs.readFileSync(cssPath, "utf8");
    const colorMatch = cssRaw.match(/--ifm-color-primary:\s*(#[0-9a-fA-F]{6});/i);
    if (colorMatch) hexColor = colorMatch[1];
  }

  // Auto-Detect Logo (prefer static/img/logo.*)
  if (INPUT_STATIC_DIR) {
    const potentialLogos = ["img/logo.svg", "img/logo.png", "logo.svg", "logo.png", "images/logo.svg", "images/logo.png"];
    for (const p of potentialLogos) {
      const abs = path.join(INPUT_STATIC_DIR, p);
      if (fs.existsSync(abs)) {
        // we copied static/img|images into /images root, so strip leading dirs
        logoPath = `/images/${path.basename(p)}`;
        break;
      }
    }
    // if that didn't hit, but we copied logo-light/logo-dark etc:
    const outImages = path.join(OUTPUT_DIR, "images");
    const fallbackLogo = ["logo-light.svg", "logo.svg", "logo.png", "logo-light.png"].find((f) => fs.existsSync(path.join(outImages, f)));
    if (!logoPath && fallbackLogo) logoPath = `/images/${fallbackLogo}`;
  }

  const tabsMap = { Guides: [], Tools: [] };
  const sdkCategorized = { Web: [], Mobile: [], "React Native": [], "UI Kits": [], "Other SDKs": [] };
  const guidesRootPages = [];

  const sortedRoot = getSortedItems(INPUT_DOCS_DIR);

  for (const { item, itemPath, isDir } of sortedRoot) {
    const lower = item.toLowerCase();
    if (item.startsWith(".") || item === "_category_.json") continue;
    if (lower === "partials") continue; // ✅ don’t show Partials in Guides

    if (isDir) {
      const group = processDirectoryHierarchy(itemPath, item);
      if (group.pages.length === 0) continue;

      // ✅ UNWRAP guides folder so sidebar shows Live Video, Voice Conferencing... (accordion)
      if (lower === "guides") {
        for (const child of group.pages) {
          if (typeof child === "object") tabsMap.Guides.push(child);
          else guidesRootPages.push(child);
        }
      } else if (lower.match(/(sdk|android|ios|react|flutter|angular|web|core|ui)/)) {
        sdkCategorized[getSdkCategory(lower)].push(group);
      } else if (lower.match(/(cli|plugin|tool|package)/)) {
        tabsMap.Tools.push(group);
      } else {
        tabsMap.Guides.push(group);
      }
    } else if (item.endsWith(".md") || item.endsWith(".mdx")) {
      guidesRootPages.push(writeMdxFile(itemPath, "", item, "Getting Started"));
    }
  }

  // ✅ Root pages go under Getting Started (collapsed by default)
  if (guidesRootPages.length > 0) {
    tabsMap.Guides.unshift({ group: "Getting Started", expanded: false, pages: guidesRootPages });
  }

  const docsJson = {
    $schema: "https://mintlify.com/docs.json",
    theme: "mint",
    name: projectName,
    colors: { primary: hexColor, light: hexColor, dark: hexColor },
    font: { family: "Inter" },
    contextual: { options: ["copy", "view"] },

    navbar: {
      links: [
        { label: "Website", href: "https://dyte.io" },
        { label: "Support", href: "mailto:support@dyte.io" },
      ],
      primary: { type: "button", label: "Sign Up", href: "https://dev.dyte.io/register" },
    },

    navigation: { tabs: [] },

    footer: {
      socials: { x: "https://x.com/dyte_io", github: "https://github.com/dyte-io" },
      links: [{ header: "Company", items: [{ label: "About Us", href: "https://dyte.io" }] }],
    },
  };

  if (logoPath) docsJson.logo = { href: "/", light: logoPath, dark: logoPath };

  // Tabs
  if (tabsMap.Guides.length > 0) docsJson.navigation.tabs.push({ tab: "Guides", groups: tabsMap.Guides });

  const sdkFinalGroups = [];
  for (const [platform, groups] of Object.entries(sdkCategorized)) {
    if (groups.length > 0) sdkFinalGroups.push({ group: platform, expanded: false, pages: groups });
  }
  if (sdkFinalGroups.length > 0) docsJson.navigation.tabs.push({ tab: "SDKs", groups: sdkFinalGroups });

  if (tabsMap.Tools.length > 0) docsJson.navigation.tabs.push({ tab: "Tools", groups: tabsMap.Tools });

  fs.writeJsonSync(path.join(OUTPUT_DIR, "docs.json"), docsJson, { spaces: 2 });

  console.log(`\n🎉 Success! Migrated ${projectName} to ${OUTPUT_DIR}.`);
  console.log(`Next:\n  cd ${OUTPUT_DIR.replace("./", "")}\n  mint dev\n`);
}

run();