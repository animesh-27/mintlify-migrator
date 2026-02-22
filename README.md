### **_Docusaurus to Mintlify: Migration Tool_** ###

This project is all about an automated CLI migration tool that takes a raw documentation repository and outputs an _(almost-ready)_ Mintlify project.

**_The ‘Why’ Behind Docusaurus:_**

I stepped into the shoes of someone handling the post-sales motion for Mintlify; Getting a customer from their legacy docs to a “Wow” moment on Mintlify is the real _(big)_ task.

I chose Docusaurus because it represents a massive slice of Mintlify’s market.

I believe companies outgrow Docusaurus because of high maintenance overhead but migrating away is kinda scary because Docusaurus uses a loosely-parsed flavor of MDX that doesn't easily copy-paste to other platforms.

_  
Key reasons to state:_

- Market-size
- Its structure is predictable but nuanced
- Migration is complex and can get ‘messy’ -> I took the call of solving something ‘messy’ enough to simulate a real world problem I’d face while working
- Solving it (decently) well could help build on for future converters for diff platforms.

  
Also, since the goal was to get a customer 85% to go-live with correct structure, content, and branding, I chose depth over breadth.

I chose Dyte’s Documentation built using Docusaurus: https://github.com/dyte-io/docs

**_Why?_**  
Dyte represents a true B2B challenge: they have complex, deeply nested hierarchies, multiple SDKs (Android, iOS, Flutter, React), UI kits and API guides. If a script can successfully parse and reorganize Dyte's documentation without manual intervention, it can handle almost any standard B2B SaaS customer.

**_The Process: How It Was Built:_**

To make this useful for a Solutions Engineering workflow, the tool needed to be "Zero Config."

1.  Ingestion: The script auto-detects the docs/ and static/ folders, scans the Docusaurus custom.css to extract the brand's primary hex color, and pulls the company logo.
2.  Information Architecture (IA) Mapping: It reads Docusaurus's \_category_.json files and frontmatter sidebar_position tags to recreate the exact reading order the customer intended.
3.  Semantic Re-Routing: Instead of blindly copying the nav, it classifies folders via Regex (e.g., matching "android" or "flutter" into an SDKs bucket, "cli" into Tools, and the rest into Guides).
4.  MDX Sanitization: It converts Docusaurus-specific components (:::info, &lt;CardList&gt;, &lt;TabItem&gt;) into Mintlify's native syntax.
5.  docs.json Generation: It builds the Mintlify configuration file, organizing the IA into clean Top-Bar Tabs, ensuring a beautiful, consumer-grade layout out of the box.

**_Reflecting on the work:_**

**_What Worked Well (WWW)_**

- The script intelligently buckets folders based on platform (e.g., "android-core" → Mobile SDKs, "react-web" → Web SDKs), preserving the exact hierarchy developers expect.
- Top Level Nav Context Switching works fine
- The script cleans up messy metadata, duplicate H1 headers are stripped, titles are normalized from filenames, and index pages are consistently labeled "Overview."

**_Where It falls short:_**

- Some Pages Render Blank due to unsupported MDX components, Imports from @docusaurus/\*, JSX fragments Mintlify cannot parse
- Guides Flattening in Some Structures: If the Docusaurus folder structure does not strongly use \_category_ metadata, grouping may degrade.
- Routing Differences :The tool compensates by ensuring index pages exist, but edge cases still require verification.

**_At Scale:_**

At scale, manual QA becomes the bottleneck. To operationalize this tool for a high-volume team, I would implement:

1. Automated QA Reports -> which lists the pages that fail MDX Parsing, broken links, missing images and unsupported components.
2. Component Compatibility Map-> a growing library of Docusaurus-to-Mintlify component translations
3. Also allow the SE to override brand colors, logos, and primary CTAs directly in the terminal before the build starts.

**_If I had more time_**
1. I'd use Sidebar.js as a source of truth instead of inferring from folders and _category_ metadata alone.
2. I'd implement a layer which could flag an unsupported Docusaurus import

## **_Final Reflection: Depth Over Breadth_**

I intentionally chose Option A (Deep Docusaurus Migration) over a general-purpose tool. By focusing on one platform, I confronted real-world complexity, MDX compatibility, deep nesting, and component drift, rather than building a shallow tool that only works on "Hello World" examples.

This tool gets a Docusaurus customer most of the way to a working Mintlify site, even though migrations are messy and not always straightforward.

Specifically, it provides:
	•	Correct navigation structure
	•	Converted content with cleaned-up frontmatter
	•	A working preview
	•	Basic branding (logo and primary color)
	•	Around 85% readiness for go-live

The remaining 15% mainly involves fixing unsupported components and handling API reference pages. Instead of rebuilding everything manually, the team can focus on targeted QA and cleanup. The goal isn’t to remove all migration complexity — it’s to reduce it to a manageable, repeatable process.

## How to Run ##

1. Clone the repository
```bash
git clone https://github.com/animesh-27/mintlify-migrator.git
cd mintlify-migrator
```

2. Install dependencies

```bash
npm install
```

3. Prepare your Docusaurus project

Place your Docusaurus repository so that it contains a docs and static directory.

The tool automatically detects the following paths:
	•	./docs
	•	./input-docusaurus/docs

4. Run the migrator

```bash
node index.js
```

This generates a mintlify-output/ directory containing:
	•	Converted MDX pages
	•	Generated docs.json configuration
	•	Copied static assets (images, logos, etc.)

5. Preview in Mintlify

```bash
cd mintlify-output
mint dev
```

This launches a local Mintlify preview of the migrated documentation.

You can paste that whole section directly.

Then run:

```bash
git add .
git commit -m “Add run instructions”
git push
```

