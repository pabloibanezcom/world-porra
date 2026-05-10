# Design System

This document describes the visual language used throughout the app. The source of truth for tokens is [`src/theme/index.ts`](src/theme/index.ts).

---

## Colors

| Token | Value | Usage |
|---|---|---|
| `bg` | `#0f1115` | Screen background |
| `card` | `#181b21` | Cards, bottom sheets |
| `card2` | `#1e2229` | Nested / inner cards, table rows |
| `border` | `rgba(255,255,255,0.07)` | Default border |
| `borderMid` | `rgba(255,255,255,0.11)` | Slightly more visible dividers |
| `text` | `#ffffff` | Primary text |
| `muted` | `#8d969e` | Secondary text, subtitles |
| `dim` | `#505a63` | Placeholder, meta, disabled |
| `accent` | `#00a87e` | Brand green — primary interactive color |
| `accentDim` | `rgba(0,168,126,0.14)` | Accent backgrounds (icon boxes, selections) |
| `blue` | `#494fdf` | Knockout / secondary highlights |
| `blueDim` | `rgba(73,79,223,0.14)` | Blue tinted backgrounds |
| `warning` | `#ec7e00` | Live matches, jokers, best-young award |
| `danger` | `#e23b4a` | Errors, loss result, LIVE pill |

### Semantic aliases (legacy compat)
`primary` = `bg`, `surface` = `card`, `textSecondary` = `muted`, `textLight` = `dim`, `success` = `accent`, `win` = `accent`, `draw` = `warning`, `loss` = `danger`.

---

## Typography

### Fonts

| Token | Font file | Usage |
|---|---|---|
| `fonts.body` | `PoolSans-Regular` | Body copy, labels, descriptions |
| `fonts.bodyMedium` | `PoolSans-Medium` | Semi-bold labels, badges, section caps |
| `fonts.display` | `PoolDisplay-Medium` | Headings, scores, team names |
| `fonts.displayBold` | `PoolDisplay-Medium` | Same family — currently same file; use for bold display text |

### Size scale

| Token | px | Typical use |
|---|---|---|
| `xs` | 10 | Meta / timestamp, caps, overline labels |
| `sm` | 12 | Secondary body, table rows, subtitles |
| `md` | 14 | Default body |
| `lg` | 16 | Slightly larger body, empty states |
| `xl` | 20 | Sub-headings |
| `xxl` | 26 | Screen titles |
| `title` | 30 | — (reserved) |

In practice several values are used directly (e.g. 11, 13, 17, 22, 24, 34) for fine-grained control, especially in scores and headers.

### Overline / section caps
Uppercase labels above sections use `fontSize: 11`, `fontFamily: fonts.bodyMedium`, `fontWeight: '600'`, `letterSpacing: 1.2`, `color: colors.dim`.

---

## Spacing

| Token | px |
|---|---|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |
| `xxl` | 48 |

Screen-level horizontal padding and gap between sections is consistently **18 px**. Card-internal padding is **14–16 px**.

---

## Border Radius

| Token | px | Usage |
|---|---|---|
| `sm` | 8 | Small buttons, badge pills |
| `md` | 10 | — |
| `lg` | 20 | — |
| `full` | 12 | Icon boxes (square with rounded corners) |

In practice, cards use `borderRadius: 16–18`, inner cards / tables use `12`, icon boxes use `10–12`, and pill badges use `9999`.

---

## Card Variants

### Base card
```
backgroundColor: colors.card
borderRadius: 16–18
borderWidth: 1
borderColor: colors.border
padding: 14–16
```

### Accent-tinted card (empty/actionable state)
Replace background/border with a tinted version of the relevant accent color at ~8–10% opacity for background and ~22–28% for border:
- Green: `rgba(0,168,126,0.08)` / `rgba(0,168,126,0.28)`
- Blue: `rgba(73,79,223,0.08)` / `rgba(73,79,223,0.22)`
- Orange (live/warning): `rgba(236,126,0,0.10)` / `rgba(236,126,0,0.32)`

### Inner / nested card
```
backgroundColor: colors.card2
borderRadius: 12
borderWidth: 1
borderColor: colors.border
```

---

## Icon System

All icons are **Ionicons** from `@expo/vector-icons`. Use the outline variant by default; switch to the filled variant only for active/selected states (e.g. bottom tab icons).

### Icon box (square with rounded corners)
Used in section cards and slot cards:
```
width: 36–40, height: 36–40
borderRadius: 10–12
backgroundColor: accentDim (or color-specific dim)
alignItems: 'center', justifyContent: 'center'
```
The icon sits inside this box at size 18–20.

### Common icon-to-concept mapping
| Icon | Concept |
|---|---|
| `trophy-outline` | Champion / winner |
| `ribbon-outline` | Runner-up |
| `football-outline` | Match / top scorer / group stage |
| `star-outline` | Best player / honors / Rules tab |
| `rocket-outline` | Best young player |
| `sparkles-outline` | Jokers |
| `bar-chart-outline` | Group standings |
| `document-text-outline` | General rules |
| `options-outline` | Tiebreaker |
| `lock-closed-outline` | Prediction locked |
| `home` / `home-outline` | Home tab |
| `people` / `people-outline` | Leagues tab |
| `person` / `person-outline` | Profile tab |

---

## Status / Result Badges

Small pill badges communicate prediction outcomes and match state.

| State | Background | Text color | Label |
|---|---|---|---|
| Exact score | `accentDim` | `accent` | `+10` |
| Correct result | `blueDim` | `blue` | `+4` |
| Wrong | `rgba(226,59,74,0.12)` | `danger` | `0` |
| LIVE | `rgba(226,59,74,0.14)` | `danger` | `LIVE` |

Pill style: `paddingHorizontal: 10`, `paddingVertical: 3–4`, `borderRadius: 8`, `fontSize: 11–12`, `fontWeight: '700'`.

---

## Bottom Tab Bar

```
backgroundColor: colors.bg
borderTopColor: colors.border, borderTopWidth: 1
height: 78, paddingTop: 10, paddingBottom: 16
tabBarActiveTintColor: colors.accent
tabBarInactiveTintColor: colors.dim
tabBarLabelStyle: fontSize 10, fontWeight '600', fonts.bodyMedium
```

Tabs: **Home, Leagues, Predictions, Rules, Profile**.

---

## Bottom Sheets (Modals)

Used for prediction entry, team/player pickers:

```
position: absolute, bottom: 0, left: 0, right: 0
backgroundColor: colors.card
borderTopLeftRadius: 22, borderTopRightRadius: 22
borderTopWidth: 1, borderColor: colors.border
maxHeight: '82%', minHeight: '60%'
```

**Handle bar**: `width: 34`, `height: 4`, `borderRadius: 2`, `backgroundColor: rgba(255,255,255,0.18)`, centered, `marginTop: 14`.

**Overlay**: `rgba(0,0,0,0.65)` with slide-up / fade-in animation (`duration: 280/220 ms`).

---

## Search Bar

Appears inside bottom sheets above list content:

```
backgroundColor: colors.bg
borderRadius: 12, borderWidth: 1, borderColor: colors.border
paddingHorizontal: 14, paddingVertical: 10
flexDirection: 'row', gap: 8
```

Leading `search` icon (`size: 14`, `color: colors.dim`). Trailing clear button when text is present.

---

## Animations

### Card entrance
Cards outside the viewport start at `opacity: 0`, `translateY: 14` and animate to visible on scroll:
```
Animated.parallel([opacity → 1, translateY → 0])
duration: 300 ms, easing: Easing.out(Easing.cubic)
```

### Odds bar fill
On first visibility, segments expand from 0 to target width:
```
duration: 700 ms, easing: Easing.out(Easing.cubic)
Labels fade in with delay: 300, duration: 400 ms
```

### Accordion (Rules screen)
Uses `LayoutAnimation.Presets.easeInEaseOut` for expand/collapse of section cards.

---

## Screens Overview

| Screen | Key pattern |
|---|---|
| Home | Greeting header, section labels, MatchCard list |
| Match List | Grouped/filtered MatchCards |
| Match Detail | Large score display, odds bar, predictions list |
| Predictions (Picks) | TournamentPicksSection + match list |
| Leagues | LeagueCard list, invite code flow |
| League Detail | Leaderboard, member rows |
| Rules | Accordion SectionCards with icon boxes |
| Profile | User stats, settings |

All screens: `SafeAreaView` with `edges={['top']}`, `backgroundColor: colors.bg`.

---

## Layout Conventions

- **Screen padding**: `18 px` horizontal and top, `40 px` bottom
- **Section gap**: `16–18 px` between major sections
- **Card gap**: `8–10 px` between cards in a list
- **Section label → first card**: `8 px` `marginBottom` on the label
- No headers in stack/tab navigators (`headerShown: false`); screens own their own header/title area
