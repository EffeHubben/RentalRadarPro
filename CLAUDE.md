# RentScout — Claude Code Instructions

## Project Stack
- **Framework**: Next.js 14 (App Router, Server Components by default)
- **Styling**: Tailwind CSS v3
- **Animation**: Framer Motion v12
- **Language**: TypeScript

Always verify a package exists in `package.json` before importing it.

---

## Design Taste Skill (via taste-skill)

### Baseline Configuration
- DESIGN_VARIANCE: 8 — push for creative, non-generic layouts
- MOTION_INTENSITY: 6 — fluid transitions, spring physics, no excessive animation
- VISUAL_DENSITY: 4 — breathable layouts, not cluttered

### Typography
- Use a clear type scale: one display size, one heading, one body, one caption
- No more than 2 font weights per component
- Line-height minimum 1.5 for body text

### Color
- Single accent color only — no multi-color gradients
- Saturation under 80% for accent colors
- **Strictly banned**: "AI purple/blue" glows, neon gradients, purple button shadows

### Layout
- No centered hero sections when DESIGN_VARIANCE > 4 — use asymmetric or left-aligned layouts
- Use `min-h-[100dvh]` instead of `h-screen` for mobile safety
- Cards only when content is truly discrete — avoid wrapping everything in cards

### Interactions
- Every interactive element must have: default, hover, active, focus, loading, and disabled states
- Forms: labels above inputs, never placeholder-only labels

### Motion
- Use `transform` and `opacity` only — never animate `top`, `left`, `width`, `height`
- Framer Motion spring physics for micro-interactions (stiffness: 300–500, damping: 20–30)
- All animated components must be isolated Client Components to protect Server Component performance
- Target 60fps on mobile — test with DevTools throttling

### Forbidden Patterns ("AI Slop")
- No emojis in code or UI content
- No generic startup copy ("Revolutionize your...", "Seamlessly...")
- No purple/blue neon glows
- No rainbow gradients
- No hero sections with centered text + CTA button as only content
- No cards-within-cards layouts

---

## Component Conventions
- Server Components by default; add `"use client"` only when interactivity requires it
- Keep client state local — don't lift to global unless truly shared
- One component per file, named to match the file
- No `any` types in TypeScript

## General Rules
- No comments unless the WHY is non-obvious
- No emojis anywhere
- Prefer editing existing files over creating new ones
- Do not add features beyond what is asked
