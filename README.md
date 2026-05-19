# The Jig Is Back

Source code and the AI chat history behind Stoa's [/sharelocalhost hero animation](https://withstoa.com/sharelocalhost) — the paper plane that flies from the share button down into the install instructions.

📝 **Blog post:** [The Jig Is Back](https://withstoa.com/blog/the-jig-is-back)
🎥 **Maker Meeting video:** [Watch on YouTube](https://youtu.be/AWQOvBRASsQ)
💬 **Chat history:** `[transcript.md](./transcript.md)` — captured with [SpecStory](https://specstory.com)

---

## Why this exists

We were building an animated hero where a paper plane traces a hand-authored flight path from a "Share" button down through the install steps. Hand-coding cubic-Bezier control points didn't converge — every iteration felt rough. So instead of guessing at numbers, we built a **path editor** ("the jig") that runs inside the page itself: drag handles to draw the curve, see a live plane preview using the exact same physics as production, and copy the resulting SVG `d` string out.

The blog post tells the story. The chat transcript shows the relevant prompts and responses that built it. The `code/` directory has the production source.

---

## The jig: how `?editPath=1` works

`HeroDemo` reads the URL on mount. If `editPath=1` is present, it renders `<PathEditor />` instead of the production demo. The editor:

1. **Decomposes the current path** into an array of points typed as `anchor` or `control`. The first point is the `M` anchor; each subsequent cubic-Bezier adds `[control1, control2, anchor]`.
2. **Renders draggable handles** in HTML positioned via percentage math against the SVG viewBox — anchors are circles, control points are squares with dashed tangent lines to their owning anchor.
3. **Drag behavior**:
  - Dragging an *anchor* translates the anchor + both flanking controls together so the local curve shape is preserved.
  - Dragging a *control* keeps its partner across the shared anchor collinear (preserving the partner's distance from the anchor) — this prevents the plane from snapping direction at the anchor. Hold **Alt** to break symmetry and create a sharp corner.
4. **Sampling-based trail reveal**. The trail is N small `<circle>` elements sampled at fixed arc-length intervals along the path. Each dot stores its parametric `t` and reveals when the plane crosses that `t`. This handles self-intersecting paths correctly (which the original mask-based reveal couldn't).
5. **Live preview** uses the exact same RAF logic and physics constants as production. What you see in the editor is what you'll get live.
6. **Output**: textarea with the current `d` string + a Copy button. Plus an Import field for round-tripping.

The whole story of building (and rebuilding) the jig is in `[transcript.md](./transcript.md)` — including the bug rounds: tangent kinks at anchors, a broken easing function with a discontinuity at t=0.45, and the moment a mask-based trail reveal had to be thrown out for a self-intersection-aware dots approach.

---

## Repo layout

```
the-jig-is-back/
├── README.md
├── transcript.md              # SpecStory capture of the AI session
└── code/
    ├── HeroDemo.tsx
    ├── PathEditor.tsx
    ├── InstallGlow.tsx
    ├── CopyCommand.tsx
    └── page.tsx
```

