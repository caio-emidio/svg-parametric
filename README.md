# SVG → 3D Parametric Tray Generator

Nuxt 4 · Vue 3 · TypeScript · Tailwind CSS v4 · shadcn-vue style components (reka-ui) · Three.js · [Manifold](https://github.com/elalish/manifold) (WASM, includes Clipper2 polygon offsetting).

Upload an SVG (or use a built-in example), pick the shapes to use, tune the dimensions, inspect the hollow open-top tray in 3D and export a binary STL. Everything runs client-side; uploaded files never leave the browser.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # geometry engine tests (vitest)
npm run build
```

## Architecture

| Module | Path |
| --- | --- |
| SVG parsing → contours (paths, polygons, rect, circle/ellipse, transforms, fill rules) | `app/engine/svg-parse.ts`, `flatten.ts`, `transform.ts` |
| Contour validation (self-intersection) | `app/engine/contours.ts` |
| Scaling, offsetting, tray generation | `app/engine/tray.ts` |
| Mesh validation (watertight, manifold, orientation, volume) | `app/engine/mesh-validate.ts` |
| Binary STL writer/reader | `app/engine/stl.ts` |
| Web Worker running the engine | `app/workers/geometry.worker.ts` |
| State, debounce, job coalescing | `app/composables/useTrayApp.ts` |
| Three.js preview | `app/components/TrayViewer.vue` |

The engine (`app/engine`) has no Vue/DOM dependency.

## Geometry pipeline

1. Parse SVG as data (never inserted into the DOM; scripts/`foreignObject`/external resources are ignored). Curves and arcs are flattened to polylines.
2. Scale the selected shapes' bounding box to the requested width × height (× scale) and centre it; flip Y.
3. Build a Clipper2 cross-section using each shape's `fill-rule`, union multiple shapes (holes, nesting and disconnected parts supported).
4. Optional external corner rounding (morphological opening with a round brush).
5. Cavity = true inward Clipper2 offset of the outline by the wall thickness (not a scaled copy). Empty result → "wall too thick" error; regions narrower than 2 × wall → warning.
6. Extrude the outline, subtract the extruded cavity from the bottom thickness upwards (open top), via Manifold, which always yields manifold output.
7. Independently validate the final mesh (closed, 2-manifold, consistently oriented, positive volume). Export is disabled unless it passes.

The preview renders exactly the mesh buffers that are written to the STL.

### Notes / limitations
- Wall taper scales the outline about its centre, so wall thickness is approximate on strongly non-convex shapes.
- Rounded rim is not implemented (not reliably supportable); 3MF is future work.
- Unsupported: text, `<use>`, masks/clip paths/filters, strokes, CSS stylesheets (warnings are shown).
- Pinched self-touching outlines (e.g. a bow-tie) can produce non-manifold geometry; these are detected and blocked from export.
