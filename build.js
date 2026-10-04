#!/usr/bin/env node
/**
 * heyNkemji build script
 * ------------------------------------------------------------
 * What this does:
 *   Reads every file in /posts, and generates:
 *     - one HTML page per post (e.g. notes-on-becoming-a-product-manager.html)
 *     - the post list on index.html
 *     - the grouped-by-year list on archive.html
 *
 * How you use it:
 *   1. Add/edit a .md file in /posts (see posts/_example.md for the format)
 *   2. Run:  node build.js
 *   3. Open index.html (or refresh, if using Live Server)
 *
 * No npm install needed — this only uses Node's built-in fs/path modules.
 * ------------------------------------------------------------ */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, "posts");
const TEMPLATE_PATH = path.join(ROOT, "templates", "post.template.html");
const INDEX_PATH = path.join(ROOT, "index.html");
const ARCHIVE_PATH = path.join(ROOT, "archive.html");

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const HOMEPAGE_POST_LIMIT = 4; // how many posts show on the homepage before "Read more"


// ---------- helpers ----------

function slugFromFilename(filename) {
  // strips a leading YYYY-MM-DD- if present, and the .md extension
  return filename
    .replace(/\.md$/, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

// turns **bold**, *italic*, and [text](url) into HTML, leaves everything else alone
function renderInline(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="inline-link" href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

// turns the plain-text body into the same paragraph/heading/quote HTML
// the site already uses. Blank line = new block.
function renderBody(body) {
  const blocks = body.trim().split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (trimmed.startsWith("## ")) {
        return `      <h2>${renderInline(trimmed.slice(3).trim())}</h2>`;
      }
      if (trimmed.startsWith("> ")) {
        return `      <blockquote>${renderInline(trimmed.slice(2).trim())}</blockquote>`;
      }
      return `      <p>${renderInline(trimmed)}</p>`;
    })
    .join("\n\n");
}

// parses the --- frontmatter --- block at the top of a post file
function parsePost(filename) {
  const raw = fs.readFileSync(path.join(POSTS_DIR, filename), "utf8");
  const match = raw.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filename}: missing frontmatter — needs a --- block at the top`);
  }
  const [, frontmatterRaw, body] = match;
  const meta = {};
  frontmatterRaw.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    meta[key] = value;
  });

  return {
    slug: meta.slug || slugFromFilename(filename),
    title: meta.title || "Untitled",
    date: meta.date || "1970-01-01",
    tag: meta.tag || "Note",
    dek: meta.dek || "",
    readtime: meta.readtime || "3 min read",
    draft: String(meta.draft).toLowerCase() === "true",
    body,
  };
}

function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map(parsePost)
    .sort((a, b) => {
      if (a.draft !== b.draft) return a.draft ? -1 : 1; // drafts always first
      return a.date < b.date ? 1 : -1; // then newest first
    });
}

function replaceBlock(fileContents, literalStart, literalEnd, newInner) {
  const pattern = new RegExp(
    `${literalStart.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}[\\s\\S]*?${literalEnd.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}`
  );
  if (!pattern.test(fileContents)) {
    throw new Error(`Could not find ${literalStart} ... ${literalEnd} in the file. Did the markers get edited or removed?`);
  }
  return fileContents.replace(pattern, `${literalStart}\n${newInner}\n${literalEnd}`);
}

// ---------- build steps ----------

function buildPostPages(posts) {
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const published = posts.filter((p) => !p.draft);

  published.forEach((post, i) => {
    const prev = published[i + 1]; // older
    const next = published[i - 1]; // newer

    const html = template
      .replaceAll("{{TITLE}}", post.title)
      .replaceAll("{{DEK}}", post.dek)
      .replaceAll("{{DESCRIPTION}}", post.dek)
      .replaceAll("{{DATE_ISO}}", post.date)
      .replaceAll("{{DATE_DISPLAY}}", formatDate(post.date))
      .replaceAll("{{TAG}}", post.tag)
      .replaceAll("{{READTIME}}", post.readtime)
      .replaceAll("{{CONTENT}}", renderBody(post.body))
      .replaceAll("{{SLUG}}", post.slug)
      .replaceAll("{{CUSDIS_APP_ID}}", "46ea00f6-300b-4803-8a7d-63e2c2d0d5b9")
      .replaceAll("{{PREV_HREF}}", prev ? `${prev.slug}.html` : "index.html")
      .replaceAll("{{PREV_TITLE}}", prev ? prev.title : "Back to journal")
      .replaceAll("{{NEXT_HREF}}", next ? `${next.slug}.html` : "index.html")
      .replaceAll("{{NEXT_TITLE}}", next ? next.title : "Back to journal");

    fs.writeFileSync(path.join(ROOT, `${post.slug}.html`), html);
    console.log(`  wrote ${post.slug}.html`);
  });
}

function entryHTML(post) {
  if (post.draft) {
    return `    <article class="entry entry--draft">
      <div class="entry__meta">
        <span class="tag">Draft</span>
      </div>
      <div>
        <h2 class="entry__title"><span>${post.title}</span></h2>
        <p class="entry__excerpt">${post.dek || "Not written yet — sitting in the queue."}</p>
      </div>
    </article>`;
  }
  return `    <article class="entry">
      <div class="entry__meta">
        <time datetime="${post.date}">${formatDate(post.date)}</time>
        <span class="tag">${post.tag}</span>
      </div>
      <div>
        <h2 class="entry__title"><a href="${post.slug}.html">${post.title}</a></h2>
        <p class="entry__excerpt">${post.dek}</p>
        <a class="entry__read" href="${post.slug}.html">Read entry</a>
      </div>
    </article>`;
}

function buildIndex(posts) {
  const shown = posts.slice(0, HOMEPAGE_POST_LIMIT);
  const hasMore = posts.length > HOMEPAGE_POST_LIMIT;

  let inner = shown.map(entryHTML).join("\n\n");
  if (hasMore) {
    inner += `\n\n    <div class="entries__more">
      <a class="btn" href="archive.html">Read more in the archive →</a>
    </div>`;
  }

  const contents = fs.readFileSync(INDEX_PATH, "utf8");
  fs.writeFileSync(INDEX_PATH, replaceBlock(contents, "<!-- ENTRIES:START -->", "<!-- ENTRIES:END -->", inner));
  console.log("  updated index.html");
}

function archiveRowHTML(post) {
  if (post.draft) {
    return `    <div class="archive-row archive-row--draft">
      <span>${post.title}</span>
      <span class="archive-date">Draft</span>
    </div>`;
  }
  const [, m, d] = post.date.split("-").map(Number);
  return `    <div class="archive-row">
      <a href="${post.slug}.html">${post.title}</a>
      <span class="archive-date">${String(d).padStart(2, "0")} ${MONTHS[m - 1]}</span>
    </div>`;
}

function buildArchive(posts) {
  const byYear = {};
  posts.forEach((post) => {
    const year = post.date.split("-")[0];
    byYear[year] = byYear[year] || [];
    byYear[year].push(post);
  });

  const years = Object.keys(byYear).sort((a, b) => b - a);
  const inner = years
    .map((year) => {
      const rows = byYear[year].map(archiveRowHTML).join("\n");
      return `  <div class="archive-year">\n    <h2>${year}</h2>\n${rows}\n  </div>`;
    })
    .join("\n\n");

  const contents = fs.readFileSync(ARCHIVE_PATH, "utf8");
  fs.writeFileSync(ARCHIVE_PATH, replaceBlock(contents, "<!-- ARCHIVE:START -->", "<!-- ARCHIVE:END -->", inner));
  console.log("  updated archive.html");
}

// ---------- run ----------

console.log("Building heyNkemji...\n");
const posts = loadPosts();
console.log(`Found ${posts.length} post(s) in /posts\n`);
buildPostPages(posts);
buildIndex(posts);
buildArchive(posts);
console.log("\nDone. Open index.html (or refresh Live Server) to see it.");
