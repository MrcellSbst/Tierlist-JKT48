# Tierlist JKT48

My JKT48 Tierlist is a Vite + React web application that bundles multiple fan-made utilities for ranking members, curating dream setlists, budgeting wishlist items, and reviewing point-history exports. It is inspired by tools such as TierMaker and JKT48 Member Sorter but focuses on JKT48-specific workflows and media.

- **Live site**: [https://tierlistjkt48.my.id](https://tierlistjkt48.my.id)

## Features

- **Tierlist Maker**: build tier lists for members, setlists, Special Show Ramadan units, MV/SPV releases, or individual songs inside a setlist; filter by status, generation, video type, or chosen setlist; supports drag-and-drop, tier customization, search, Tim LOVE highlights, manual saves, auto-saves, and PNG export.
- **Setlist Song Tierlist**: `/tierlist_lagu` focuses on ranking songs while reusing the same drag-and-drop tooling and setlist data defined in `src/data/setlistSongs.js`.
- **Dream Setlist Builder**: plan show layouts by assigning songs and members (including backups), color-code tiers, multi-select, search, and export the resulting board as a PNG.
- **Wishlist Calculator**: compile events/merch wishlist items using `src/data/wishlistpriceData.js`, add custom entries, total the cost automatically, maintain multiple drafts, and export to either PNG or Excel.
- **Points History Explorer**: visualize the data saved by the companion "JKT48 Points History Exporter" browser extension through tables, summary chips, and Recharts-based graphs, then export the dataset as CSV.

### Data sources

- `src/data/memberData.js`: list of active/ex-member photos and filenames.
- `src/data/SetlistData.js`, `src/data/setlistSongs.js`, `src/data/specialshowData.js`, `src/data/spv_mv.js`: assets for each tierlist category.
- `src/data/wishlistpriceData.js`: base price catalog for the calculator.
- `src/data/PointHistoryData.js`: color palettes and config for the analytics screen.

Update the files above (and the matching images in `public/asset`) to add new members, songs, or prices.

## Usage

1. The landing page lets you choose between the Tierlist Maker and the Dream Setlist builder. From Tierlist Maker you can jump to tier lists, calculators, point history, and other utilities.
2. For tier lists, pick the desired category, adjust filters, optionally load a saved draft, then click **Start Making Tierlist**.
3. Use the toolbar inside each feature (for example "Save Draft", "Export PNG/CSV/Excel") to keep or share your work.

## Getting started locally

### Requirements

- Node.js 18 or newer (matches Vite 5's minimum)
- npm 9+ (or any Node-compatible package manager)

### Installation & development

```bash
npm install
npm run dev
```

The dev server runs on the port printed by Vite (default `http://localhost:5173`). Hot Module Replacement is enabled.

### Production build

```bash
npm run build
# optional preview of the production bundle
npm run preview
```

The static build is output to `dist/` and can be deployed directly to services such as Vercel or Netlify.

### Environment variables

No environment variables are required for the currently enabled features.

## Deployment

1. Push the code to your Git provider.
2. Create a Vercel project (or another static host) and point it at the repo.
3. Set build command `npm run build` and output directory `dist`.

## Contributing

Contributions, bug fixes, and data updates are welcome. Fork the repository, create a topic branch, and submit a pull request. Please keep tierlist assets and data sources in sync (e.g., when adding a member image, also update the relevant `*.js` data file).

## License

This project uses the custom [Tierlist JKT48 License](License.txt).
