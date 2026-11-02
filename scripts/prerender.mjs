#!/usr/bin/env node
/**
 * Post-build prerender script.
 * Reads dist/index.html, then for every route creates a directory with an
 * index.html whose <title>, meta description, OG, Twitter, canonical, and
 * JSON-LD breadcrumbs are baked in — so crawlers, AI models, and link
 * previews see the correct per-page metadata without executing JavaScript.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { loadPublishedPosts } from './blog-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const DOMAIN = 'https://www.firstprincipleslearningg.com';

// ── Tool data (mirrors src/config/tools.tsx) ────────────────────────
const tools = [
  // Math
  { slug: 'unit-circle', name: 'Unit Circle', tag: 'Trigonometry', description: 'Explore sine, cosine, and angle relationships on an interactive unit circle.', category: 'math' },
  { slug: 'plotter-3d', name: '3D Surface Plotter', tag: 'Multivariable Calculus', description: 'Visualize three-dimensional functions with an interactive WebGL surface plotter.', category: 'math' },
  { slug: 'slope-field', name: 'Slope Field', tag: 'Differential Equations', description: 'Draw slope fields for any dy/dx expression and sketch solution curves.', category: 'math' },
  { slug: 'derivative-integral', name: 'Differentiation & Integration', tag: 'Calculus', description: 'Compute derivatives, integrals, and visualize the area under any curve.', category: 'math' },
  { slug: 'graphing-calculator', name: 'Graphing Calculator', tag: 'Algebra & Calculus', description: 'Plot multiple functions simultaneously with a full-featured graphing calculator.', category: 'math' },
  { slug: 'diff-eq-solver', name: 'Differential Equation Solver', tag: 'Differential Equations', description: 'Solve and visualize first and second order differential equations step by step.', category: 'math' },
  { slug: 'matrix-calculator', name: 'Matrix Calculator', tag: 'Linear Algebra', description: 'Perform matrix operations, compute eigenvalues, and visualize transformations.', category: 'math' },
  { slug: 'integration-visualizer', name: 'Integration Visualizer', tag: 'Calculus', description: 'Watch Riemann sums converge to the integral with adjustable rectangles and methods.', category: 'math' },
  { slug: 'probability-sim', name: 'Probability Simulator', tag: 'Statistics', description: 'Run coin flips, dice rolls, and weighted experiments — see histograms build in real time.', category: 'math' },
  { slug: 'taylor-series', name: 'Taylor Series Explorer', tag: 'Calculus', description: 'Build Taylor polynomials term by term and watch them converge to the original function.', category: 'math' },
  { slug: 'complex-plotter', name: 'Complex Number Plotter', tag: 'Complex Analysis', description: 'Visualize complex number operations on an Argand diagram with magnitude and argument.', category: 'math' },
  { slug: 'equation-solver', name: 'Equation Solver', tag: 'Algebra', description: 'Solve linear and quadratic equations with detailed step-by-step explanations.', category: 'math' },
  { slug: 'fourier-series', name: 'Fourier Series', tag: 'Signals', description: 'Build periodic waves from sine harmonics with animated epicycles and live convergence.', category: 'math' },
  { slug: 'fourier-transform', name: 'Fourier Transform', tag: 'Signals', description: 'Compose signals from sinusoids and see the DFT decompose them into frequency spectra.', category: 'math' },
  { slug: 'laplace-transform', name: 'Laplace Transform', tag: 'Signals & Systems', description: 'Explore pole-zero plots, impulse responses, and Bode magnitudes for classic transfer functions.', category: 'math' },
  { slug: 'vector-field', name: 'Vector Field Visualizer', tag: 'Multivariable Calculus', description: 'Visualize 2D vector fields with animated flow particles, divergence and curl heatmaps, and custom expressions.', category: 'math' },
  { slug: 'monte-carlo', name: 'Monte Carlo Simulator', tag: 'Statistics', description: 'Estimate pi, compute integrals, and run Buffon\'s needle — see how random sampling converges to exact values.', category: 'math' },
  { slug: 'statistics-calc', name: 'Statistics Calculator', tag: 'Statistics', description: 'Visualize data with histograms, compute mean, median, mode, std dev, quartiles, and fit a normal curve.', category: 'math' },
  { slug: 'number-theory', name: 'Number Theory Explorer', tag: 'Number Theory', description: 'Visualize the Euclidean algorithm for GCD, prime factorization trees, and modular arithmetic on a clock.', category: 'math' },
  { slug: 'linear-algebra-viz', name: 'Linear Algebra Visualizer', tag: 'Linear Algebra', description: 'Animate 2x2 matrix transformations on a grid. See eigenvectors, determinant, and how matrices warp space.', category: 'math' },

  // Physics
  { slug: 'circuit-builder', name: 'Circuit Builder', tag: 'Electromagnetism', description: 'Build and analyze DC circuits with resistors, capacitors, and voltage sources.', category: 'physics' },
  { slug: 'orbital-mechanics', name: 'Orbital Gravity Simulator', tag: 'Mechanics', description: "Simulate planetary orbits and explore Kepler's laws with gravitational physics.", category: 'physics' },
  { slug: 'ray-optics', name: 'Ray Optics', tag: 'Optics', description: 'Trace light rays through lenses and mirrors to understand image formation.', category: 'physics' },
  { slug: 'double-pendulum', name: 'Double Pendulum', tag: 'Chaos Theory', description: 'Watch chaotic motion emerge from simple physics in a double pendulum system.', category: 'physics' },
  { slug: 'spring-mass', name: 'Spring-Mass System', tag: 'Mechanics', description: 'Explore oscillatory motion with adjustable mass, spring constant, and damping.', category: 'physics' },
  { slug: 'momentum-conservation', name: 'Momentum Conservation', tag: 'Mechanics', description: 'Visualize elastic and inelastic collisions and verify conservation of momentum.', category: 'physics' },
  { slug: 'projectile-motion', name: 'Projectile Motion Lab', tag: 'Mechanics', description: 'Fire projectiles with adjustable angle, speed, and air resistance. See trajectory, range, and max height.', category: 'physics' },
  { slug: 'electric-field', name: 'Electric Field Visualizer', tag: 'Electromagnetism', description: 'Place positive and negative charges, see field lines and equipotential regions in real time.', category: 'physics' },
  { slug: 'wave-superposition', name: 'Wave Superposition', tag: 'Waves', description: 'Combine two waves with adjustable frequency, amplitude, and phase to see interference patterns.', category: 'physics' },
  { slug: 'free-body-diagram', name: 'Free Body Diagram', tag: 'Mechanics', description: 'Build force diagrams with draggable forces, auto-compute net force and acceleration.', category: 'physics' },
  { slug: 'thermo-pv', name: 'PV Diagram', tag: 'Thermodynamics', description: 'Explore isothermal, adiabatic, isobaric, and isochoric processes with work calculation.', category: 'physics' },
  { slug: 'quantum-wave', name: 'Quantum Wave Function', tag: 'Quantum Mechanics', description: 'Visualize wave functions and probability densities for a particle in a box with quantized energy levels.', category: 'physics' },
  { slug: 'em-induction', name: 'Electromagnetic Induction', tag: 'Electromagnetism', description: "Move a bar magnet through a coil and watch Faraday's law in action — see induced EMF and flux change in real time.", category: 'physics' },
  { slug: 'lens-mirror', name: 'Lens & Mirror Calculator', tag: 'Optics', description: 'Trace principal rays through converging/diverging lenses and concave/convex mirrors. See real and virtual images form.', category: 'physics' },

  // CS
  { slug: 'pathfinding', name: 'Pathfinding', tag: 'Graph Algorithms', description: 'Visualize A*, Dijkstra, and BFS algorithms finding the shortest path on a grid.', category: 'cs' },
  { slug: 'sql-visualizer', name: 'SQL Visualizer', tag: 'Databases', description: 'Write SQL queries and see the results visualized as interactive table joins.', category: 'cs' },
  { slug: 'sorting-visualizer', name: 'Sorting Visualizer', tag: 'Algorithms', description: 'Watch bubble sort, merge sort, quicksort, and more animate step by step.', category: 'cs' },
  { slug: 'graph-traversal', name: 'Graph Traversal', tag: 'Graph Algorithms', description: 'Step through BFS and DFS traversals on custom graphs you build yourself.', category: 'cs' },
  { slug: 'recursion-visualizer', name: 'Recursion Visualizer', tag: 'Algorithms', description: 'See recursion call trees unfold in real time for factorial, fibonacci, and more.', category: 'cs' },
  { slug: 'binary-tree', name: 'Binary Search Tree', tag: 'Data Structures', description: 'Insert, delete, and traverse a BST with animated in-order, pre-order, and post-order walks.', category: 'cs' },
  { slug: 'stack-queue', name: 'Stack & Queue', tag: 'Data Structures', description: 'Push, pop, enqueue, dequeue — visualize LIFO and FIFO data structures side by side.', category: 'cs' },
  { slug: 'linked-list', name: 'Linked List', tag: 'Data Structures', description: 'Visual insert, delete, reverse a linked list with animated pointer arrows.', category: 'cs' },
  { slug: 'bigo-comparator', name: 'Big-O Comparator', tag: 'Algorithms', description: 'Plot O(1) through O(2^n) growth curves overlaid to visually compare complexity classes.', category: 'cs' },
  { slug: 'regex-tester', name: 'Regex Tester', tag: 'Programming', description: 'Test regular expressions with live highlighting, match details, and a handy cheatsheet.', category: 'cs' },
  { slug: 'fsm-builder', name: 'Finite State Machine', tag: 'Automata', description: 'Build finite automata with draggable states, add transitions, and test input strings.', category: 'cs' },
  { slug: 'code-visualizer', name: 'Code Visualizer', tag: 'Programming', description: 'Step through JavaScript code and watch variables, arrays, and objects come alive in memory.', category: 'cs' },
  { slug: 'packet-simulator', name: 'Packet Simulator', tag: 'Networking', description: 'Simulate TCP handshakes, data transfer, packet loss, retransmission, and UDP — animated network packet flow.', category: 'cs' },
  { slug: 'hash-table', name: 'Hash Table Visualizer', tag: 'Data Structures', description: 'Insert keys and watch hashing, collisions, chaining, and open addressing in action.', category: 'cs' },
  { slug: 'logic-gates', name: 'Logic Gate Simulator', tag: 'Digital Logic', description: 'Build circuits with AND, OR, NOT, NAND, NOR, XOR, XNOR gates — toggle inputs and see truth tables.', category: 'cs' },
  { slug: 'cpu-pipeline', name: 'CPU Pipeline Simulator', tag: 'Computer Architecture', description: 'Step through IF, ID, EX, MEM, WB stages. See data hazards, control hazards, and how instructions overlap.', category: 'cs' },
  { slug: 'memory-allocator', name: 'Memory Allocator', tag: 'Operating Systems', description: 'malloc() and free() heap blocks. Compare first-fit, best-fit, worst-fit strategies and watch fragmentation form.', category: 'cs' },
  { slug: 'turing-machine', name: 'Turing Machine', tag: 'Theory of Computation', description: 'Run Turing machines step by step on a tape. Preloaded with 0^n1^n recognizer, binary increment, and string copy.', category: 'cs' },
];

const CATEGORY_DISPLAY = { math: 'Mathematics', physics: 'Physics', cs: 'Computer Science' };

const categoryMeta = {
  math: {
    seoTitle: 'Free Math Tools — Interactive Calculators & Visualizers | FirstPrinciple',
    seoDesc: 'Explore 20 free interactive math tools: graphing calculator, unit circle, Fourier transform visualizer, equation solver, matrix tools, and more. No login required.',
  },
  physics: {
    seoTitle: 'Free Physics Simulations — Interactive Labs | FirstPrinciple',
    seoDesc: 'Run real-time physics simulations: circuit builder, projectile motion, electric fields, wave superposition, ray optics, orbital mechanics, and more. Free, no login.',
  },
  cs: {
    seoTitle: 'Free CS Tools — Algorithm Visualizers & Data Structures | FirstPrinciple',
    seoDesc: 'Visualize sorting algorithms, graph traversal, binary trees, stacks, queues, linked lists, finite state machines, and Big-O complexity. Free, no login.',
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function breadcrumbLD(items) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((bc, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: bc.name,
      item: bc.url,
    })),
  });
}

function webAppLD(tool, category) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: tool.name,
    description: tool.description,
    url: `${DOMAIN}/${category}/${tool.slug}`,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CAD' },
    author: { '@type': 'Organization', name: 'FirstPrinciple Tutoring', url: DOMAIN },
  });
}

function noscriptContent(title, description, links) {
  let html = `<h1>${escHtml(title)}</h1>\n    <p>${escHtml(description)}</p>`;
  if (links) {
    html += `\n    <nav><ul>${links.map(l => `<li><a href="${l.href}">${escHtml(l.text)}</a></li>`).join('')}</ul></nav>`;
  }
  return html;
}

/**
 * Replace meta tags in the template HTML for a specific page.
 */
function injectMeta(template, { title, description, canonical, ogType, breadcrumbs, extraLD, noscript }) {
  let html = template;

  // Title
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escHtml(title)}</title>`);

  // Meta description
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${escHtml(description)}$2`
  );

  // Canonical
  html = html.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    `$1${canonical}$2`
  );

  // OG tags
  html = html.replace(/(property="og:title"\s+content=")[^"]*(")/,  `$1${escHtml(title)}$2`);
  html = html.replace(/(property="og:description"\s+content=")[^"]*(")/,  `$1${escHtml(description)}$2`);
  html = html.replace(/(property="og:url"\s+content=")[^"]*(")/,  `$1${canonical}$2`);
  html = html.replace(/(property="og:type"\s+content=")[^"]*(")/,  `$1${ogType || 'website'}$2`);

  // Twitter tags
  html = html.replace(/(name="twitter:title"\s+content=")[^"]*(")/,  `$1${escHtml(title)}$2`);
  html = html.replace(/(name="twitter:description"\s+content=")[^"]*(")/,  `$1${escHtml(description)}$2`);

  // Inject breadcrumb + extra JSON-LD before </head>
  let ldScripts = '';
  if (breadcrumbs) {
    ldScripts += `\n  <script type="application/ld+json">${breadcrumbLD(breadcrumbs)}</script>`;
  }
  if (extraLD) {
    ldScripts += `\n  <script type="application/ld+json">${extraLD}</script>`;
  }
  if (ldScripts) {
    html = html.replace('</head>', `${ldScripts}\n</head>`);
  }

  // Replace noscript block
  if (noscript) {
    html = html.replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript>\n    ${noscript}\n  </noscript>`
    );
  }

  return html;
}

function writePage(route, html) {
  const dir = join(DIST, route);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, 'index.html');
  // Don't overwrite the root index.html (it's already the template)
  if (route === '') {
    writeFileSync(join(DIST, 'index.html'), html);
  } else {
    writeFileSync(file, html);
  }
}

// ── Main ────────────────────────────────────────────────────────────

const template = readFileSync(join(DIST, 'index.html'), 'utf-8');
let count = 0;

// 1. Root page (already has good meta, but let's ensure noscript is up to date)
// Root is already good — skip

// 2. Category gallery pages
for (const cat of ['math', 'physics', 'cs']) {
  const meta = categoryMeta[cat];
  const catTools = tools.filter(t => t.category === cat);
  const catDisplay = CATEGORY_DISPLAY[cat];
  const canonical = `${DOMAIN}/${cat}`;

  const toolLinks = catTools.map(t => ({
    href: `/${cat}/${t.slug}`,
    text: `${t.name} — ${t.description}`,
  }));

  const html = injectMeta(template, {
    title: meta.seoTitle,
    description: meta.seoDesc,
    canonical,
    breadcrumbs: [
      { name: 'Home', url: `${DOMAIN}/` },
      { name: catDisplay, url: canonical },
    ],
    noscript: noscriptContent(
      `${catDisplay} Tools — FirstPrinciple Tutoring`,
      meta.seoDesc,
      toolLinks
    ),
  });

  writePage(cat, html);
  count++;
}

// 3. Individual tool pages
for (const tool of tools) {
  const catDisplay = CATEGORY_DISPLAY[tool.category];
  const canonical = `${DOMAIN}/${tool.category}/${tool.slug}`;
  const title = `${tool.name} — Free ${catDisplay} Tool | FirstPrinciple`;
  const desc = `${tool.description} Free interactive ${tool.tag.toLowerCase()} tool. No login required.`;

  const html = injectMeta(template, {
    title,
    description: desc,
    canonical,
    breadcrumbs: [
      { name: 'Home', url: `${DOMAIN}/` },
      { name: catDisplay, url: `${DOMAIN}/${tool.category}` },
      { name: tool.name, url: canonical },
    ],
    extraLD: webAppLD(tool, tool.category),
    noscript: noscriptContent(tool.name, desc, [
      { href: `/${tool.category}`, text: `Back to ${catDisplay} tools` },
    ]),
  });

  writePage(`${tool.category}/${tool.slug}`, html);
  count++;
}

// 4. Reviews page
{
  const html = injectMeta(template, {
    title: 'Student Reviews — FirstPrinciple Tutoring',
    description: 'Read real student reviews and leave your own feedback. See why students love first-principles tutoring in Math, Physics, and Computer Science.',
    canonical: `${DOMAIN}/reviews`,
    breadcrumbs: [
      { name: 'Home', url: `${DOMAIN}/` },
      { name: 'Reviews', url: `${DOMAIN}/reviews` },
    ],
    noscript: noscriptContent(
      'Student Reviews — FirstPrinciple Tutoring',
      'Read real student reviews for Math, Physics, and CS tutoring.',
      [{ href: '/', text: 'Back to Home' }]
    ),
  });
  writePage('reviews', html);
  count++;
}

// 5. Blog: index + one page per published post, read from Firestore at build time.
//    Replaces the separate firstprinciple-blog app that /blog used to be proxied to.
//    The article is real HTML inside #root (visible to crawlers, link previews and no-JS readers);
//    React replaces it when the app boots.
const posts = await loadPublishedPosts();
if (posts) {
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
  const readTime = (c) => `${Math.max(1, Math.ceil(c.trim().split(/\s+/).length / 200))} min read`;
  const ldJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  const withRoot = (html, inner) => html.replace('<div id="root"></div>', `<div id="root">${inner}</div>`);
  const BLOG_SUFFIX = ' | FirstPrinciple Blog';

  // 5a. Index
  {
    const title = `Blog — STEM Tutorials & Guides${BLOG_SUFFIX}`;
    const description = 'Deep-dive tutorials on Math, Physics, and Computer Science. First-principles explanations with free interactive tools.';
    const canonical = `${DOMAIN}/blog`;
    const cards = posts.map(p => `<article><h2><a href="/blog/${escHtml(p.slug)}">${escHtml(p.title)}</a></h2><p>${escHtml(p.description)}</p><p>${escHtml(p.tag)} · ${escHtml(fmtDate(p.createdAt))}</p></article>`).join('\n');
    let html = injectMeta(template, {
      title, description, canonical,
      breadcrumbs: [{ name: 'Home', url: `${DOMAIN}/` }, { name: 'Blog', url: canonical }],
      noscript: noscriptContent('FirstPrinciple Blog', description, [{ href: '/', text: 'Back to Home' }]),
    });
    html = withRoot(html, `<main class="blog-container"><h1>FirstPrinciple Blog</h1><p>${escHtml(description)}</p>\n${cards}</main>`);
    writePage('blog', html);
    count++;
  }

  // 5b. Posts
  for (const p of posts) {
    const canonical = `${DOMAIN}/blog/${p.slug}`;
    const title = `${p.title}${BLOG_SUFFIX}`;
    const body = renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], skipHtml: true, children: p.content }));
    const articleLD = ldJson({
      '@context': 'https://schema.org', '@type': 'Article',
      headline: p.title, description: p.description,
      datePublished: p.createdAt, dateModified: p.updatedAt,
      author: { '@type': 'Organization', name: 'FirstPrinciple Tutoring', url: DOMAIN },
      publisher: { '@type': 'Organization', name: 'FirstPrinciple Tutoring' },
      mainEntityOfPage: canonical,
    });
    let html = injectMeta(template, {
      title, description: p.description, canonical, ogType: 'article',
      breadcrumbs: [
        { name: 'Home', url: `${DOMAIN}/` },
        { name: 'Blog', url: `${DOMAIN}/blog` },
        { name: p.title, url: canonical },
      ],
      extraLD: articleLD,
      noscript: noscriptContent(p.title, p.description, [{ href: '/blog', text: 'Back to all posts' }]),
    });
    const articleMeta = `\n  <meta property="article:published_time" content="${escHtml(p.createdAt)}" />` +
      `\n  <meta property="article:author" content="FirstPrinciple Tutoring" />`;
    html = html.replace('</head>', `${articleMeta}\n</head>`);
    html = withRoot(html, `<main class="blog-container"><article><header class="post-header"><a href="/blog" class="post-header-back">← Back to all posts</a><h1>${escHtml(p.title)}</h1><div class="post-header-meta"><span class="post-card-tag">${escHtml(p.tag)}</span> <span>${escHtml(fmtDate(p.createdAt))}</span> · <span>${readTime(p.content)}</span></div></header><div class="prose">${body}</div><p><a href="${DOMAIN}">Book a free 30-minute consultation with a FirstPrinciple tutor →</a></p></article></main>`);
    writePage(`blog/${p.slug}`, html);
    count++;
  }

  // 5c. Sitemap: the static entries from public/sitemap.xml, minus any hand-written /blog URLs,
  //     plus every published post (lastmod = the post's updatedAt/createdAt).
  const smPath = join(DIST, 'sitemap.xml');
  const sm = readFileSync(smPath, 'utf-8');
  const stripped = sm
    .replace(/\s*<!-- Blog -->/, '')
    .replace(/\s*<url><loc>[^<]*\/blog(?:\/[^<]*)?<\/loc>[\s\S]*?<\/url>/g, '');
  const day = (iso) => (iso || new Date().toISOString()).slice(0, 10);
  const blogUrls = [
    `  <url><loc>${DOMAIN}/blog</loc><lastmod>${day(posts[0].updatedAt || posts[0].createdAt)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ...posts.map(p => `  <url><loc>${DOMAIN}/blog/${escHtml(p.slug)}</loc><lastmod>${day(p.updatedAt || p.createdAt)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`),
  ].join('\n');
  writeFileSync(smPath, stripped.replace('</urlset>', `\n  <!-- Blog (generated at build from Firestore) -->\n${blogUrls}\n</urlset>`));
  console.log(`Sitemap: ${posts.length + 1} blog URLs generated`);
}

console.log(`Prerendered ${count} pages into dist/`);
