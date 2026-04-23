# IFRIT — Design Context

> Fire Detection & AI Monitoring Platform
> Landing page design context for the impeccable skill.

---

## Design Context

### Users

**Primary visitors:** Building owners evaluating fire safety solutions, facility managers responsible for safety compliance, and investors assessing the product's commercial potential.

**Tech literacy:** Mixed — building owners may be non-technical decision-makers who care about reliability and ROI; facility managers have operational knowledge but aren't engineers; investors evaluate market positioning and innovation.

**Context of use:** Browsing from office desktops or laptops during business hours. They've likely been linked here from a pitch deck, LinkedIn post, industry search, or referral. First impressions are everything — they will judge the product's credibility by the quality of the landing page within 3 seconds.

**Job to be done:** Evaluate whether IFRIT is a credible, cutting-edge fire detection solution worth contacting for a demo or purchasing. They need to quickly understand what it does, how it's different, and why they should trust it.

### Brand Personality

**Voice:** Authoritative but not cold. Technical but accessible. Speaks with the confidence of proven engineering.

**3-word personality:** Trustworthy · Innovative · Cinematic

**Emotional goals:**
- First 3 seconds: "This is serious, advanced technology" — not a toy, not a student project
- After scrolling: "This is genuinely innovative — AI + IoT + real-time alerting is a real differentiator"
- By the CTA: "I need to talk to these people"

**Brand name:** IFRIT — a mythological fire spirit (djinn). The name carries weight: ancient, powerful, elemental. The brand should feel like it commands fire rather than fears it.

**Tagline direction:** Something that conveys control over fire, not just detection. "Guardian" energy — watching, protecting, responding.

### Aesthetic Direction

**Visual tone:** Cinematic hybrid — opens with a dark, dramatic hero section that commands attention, then transitions into lighter content sections for readability and trust-building. Not a pure dark site, not a pure light site. The shift creates narrative rhythm: danger → solution → confidence.

**Primary palette:**
- **Red** as the dominant brand color — but a sophisticated, deep red (not neon, not cherry). Think ember red, volcanic glass, controlled fire. Must not strain the eyes — achieved through careful lightness control in OKLCH (keep lightness moderate, chroma restrained for large surfaces, higher chroma only on small accents and CTAs).
- **Amber** as the secondary accent — inherited from the product's sensor/alert vocabulary. Brings warmth and connects to the dashboard product.
- **Neutrals** — warm-tinted darks for the hero section, cool-shifted lighter neutrals for content sections. Never pure black or pure white.

**Theme:** Cinematic hybrid. Dark hero → gradual transition → lighter content sections → dark footer. The dark sections communicate power and technology; the lighter sections communicate clarity and trustworthiness.

**Motion:** Cinematic entrance animations in the hero section are critical. Staggered reveals, parallax depth, or particle/ember effects to create a "wow" moment. Rest of the page uses subtle scroll-triggered reveals — purposeful, not gratuitous. Every animation must serve the narrative.

**References (conceptual, not specific sites):**
- The gravity of a defense contractor's product page
- The motion quality of a high-end film studio's title sequence
- The clarity of Stripe's feature explanations
- The confidence of Apple's product marketing

**Anti-references:**
- Generic AI slop: cyan-on-dark, gradient text, cards-with-icons grids
- Mainstream SaaS templates: identical hero → 3-column features → testimonials → pricing
- Corporate fire safety company websites: clip-art fire extinguishers, stock photos of people pointing at smoke detectors
- Over-designed startup pages with animations that serve no purpose

### Content Structure

1. **Hero** — Cinematic, full-viewport. Product name (IFRIT), tagline, primary CTA (Request Demo / Contact Us). Animated, dramatic, unforgettable.
2. **Problem Statement** — Brief: why traditional fire detection fails. Sets up the need.
3. **Features** — The three pillars: AI Computer Vision (YOLO/Segmentation on CCTV), IoT Sensor Fusion (gas + temp + humidity), Real-time Alerting (WhatsApp + Dashboard). Not presented as identical cards — each gets its own visual treatment.
4. **Tech Stack / How It Works** — Visual system architecture diagram. Show the data flow from sensor → AI → alert. This is where technical credibility lives.
5. **CTA (mid-page)** — "See IFRIT in action" — secondary conversion point.
6. **Trust signals** — Stats, certifications, or use-case scenarios (can be placeholder for now).
7. **Final CTA** — Strong closing with contact form or demo request.
8. **Footer** — Links, language switcher, legal.

**CTAs distributed throughout** — not just at the bottom. Every major section should have a clear next step.

### Design Principles

1. **Command, don't beg.** IFRIT is a guardian. The landing page should radiate quiet authority — not desperately sell. The product speaks for itself through clear, confident presentation.

2. **Cinematic narrative over information dump.** The page tells a story: danger exists → IFRIT watches → IFRIT responds → you're protected. Each section advances this arc. Scroll = progress through the story.

3. **Restrained fire.** Red is the brand color but it's used like a controlled burn — precise, intentional, never overwhelming. Large surfaces stay neutral; red appears in accents, CTAs, and key moments. Amber warms the edges.

4. **Technical credibility through transparency.** Show the actual architecture, the actual AI pipeline, the actual sensor stack. Don't hide behind marketing fluff. The tech IS the selling point — display it with pride and clarity.

5. **No AI slop, no templates.** Every element must feel hand-crafted and intentional. If it looks like "any AI could have made this," it's wrong. The goal: someone sees this and asks "who designed this?" not "which template is this?"

### Internationalization

- **Bilingual:** Indonesian (primary) and English
- **Switchable:** Language toggle in the header/nav, persisted in localStorage
- **Implementation:** i18n key-value approach — all visible strings externalized

### Accessibility

- WCAG AA contrast ratios minimum (especially important given the red palette — red text on dark backgrounds is notoriously low-contrast)
- `prefers-reduced-motion` respected — all cinematic animations gracefully degrade to instant reveals
- Semantic HTML throughout
- Focus-visible styles for keyboard navigation
- Alt text for all images and decorative elements marked with `aria-hidden`
- Skip-to-content link
