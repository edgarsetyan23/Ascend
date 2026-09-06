# Mini Edgar likeness update

This working copy comes from the newer extracted Downloads project containing
`TourGuide.jsx`, not the older supplied ZIP. Existing exhibit positioning, hero
size, navigation triggers, and mobile visibility remain controlled by RecruiterView.

The head now uses a continuous shaped mesh with a blended nose, controlled jaw,
smaller eyes with eyelids, thick brows, subtle facial hair, and a swept hair surface.
The supplied close-up was the primary visual reference. This is an artistic,
stylized likeness; the photographs do not establish an accurate side/back profile.

## Run the applications

```sh
npm install
npm run dev
```

- Portfolio: `/portfolio/`
- Companion application: `/mini-edgar-studio.html`

The studio runs independently of authentication and API credentials. Choose a local
reference photo, adjust the sliders, inspect the side view, and export the likeness.
The photo is displayed through a local browser object URL and is never uploaded.
Slider changes apply on release. Reset restores the checked-in defaults.

To apply exported settings to the portfolio, replace
`src/components/edgar-likeness.json` with the downloaded JSON and run `npm run build`.
Settings are not automatically saved by the studio. Both applications import the
same head generator and preset, so changes to the preset apply to both.

The added dependency is [lil-gui](https://lil-gui.georgealways.com/), used only by
the studio controls. The rendering continues to use the existing Three.js dependency.
Vite builds both HTML entry points. No Blender installation is required.

## Validation

- Production build and 16 existing Vitest tests passed.
- Headless Edge: canvas rendered, reference loaded, full-body/face switching,
  animation controls, JSON download, reduced-motion mode, and narrow viewport checked.
- No page JavaScript errors in the studio smoke check.
- Existing build warnings remain for large chunks and outdated Browserslist data.
- This copy omits local secrets and backend environment values; authenticated
  tracker features require your existing configuration before deployment.

Review the appearance before deploying; no live site was changed.
