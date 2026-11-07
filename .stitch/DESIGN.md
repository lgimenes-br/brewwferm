# Design System: Breww Smart Controller

## 1. Visual Theme & Atmosphere
Breww is a high-precision smart fermentation, kegerator, and refrigeration controller interface designed with a **Dark Obsidian Industrial-Minimalist** aesthetic (inspired by Apple Pro dark interfaces and Teenage Engineering / Linear telemetry dashboards).

- **Atmosphere:** Deep obsidian canvas (`#050505`) with subtle dark charcoal surfaces (`#171717` / `neutral-900`) and crisp `1px` borders (`#262626` / `neutral-800`).
- **Philosophy:** Zero visual clutter, high-contrast telemetry readouts in monospace font, tactile large rounded cards (`24px` / `rounded-3xl`), and semantic color-coding for thermal and biological states.
- **Language:** All interface labels, headings, and microcopy are in **Brazilian Portuguese (pt-BR)**.

## 2. Color Palette & Roles

| Role | Token / Name | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Background Primary** | Obsidian Canvas | `#050505` | Full-bleed application background |
| **Surface Card** | Charcoal Surface | `#171717` | Main device cards, panels, modals (`bg-neutral-900/50`) |
| **Surface Elevated** | Elevated Slate | `#0A0A0A` | Inner metric boxes, input fields, recessed wells (`bg-neutral-950`) |
| **Border Default** | Hairline Carbon | `#262626` | 1px solid card borders and dividers (`border-neutral-800`) |
| **Text Primary** | Pure White | `#FFFFFF` | Primary headings, temperature readouts, active labels |
| **Text Secondary** | Muted Zinc | `#A3A3A3` | Subtitles, descriptions, inactive tabs (`text-neutral-400`) |
| **Text Tertiary** | Technical Slate | `#737373` | Uppercase micro-labels, timestamps, unit suffixes (`text-neutral-500`) |
| **Primary Action** | Crisp White CTA | `#FFFFFF` | Primary buttons with `#000000` bold text (`bg-white text-black`) |
| **Status Online / Active** | Emerald Pulse | `#10B981` | Online indicator dot, active fermentation, success badges |
| **Cooling / Fridge Mode** | Cryo Blue | `#3B82F6` | Cooling compressor active (`Resfriando`), Fridge Mode (`Modo Geladeira`) |
| **Heating / Kegerator** | Amber Brew | `#F59E0B` | Heating active (`Aquecendo`), Kegerator Mode (`Modo Chopeira`), warnings |
| **Gravity / Telemetry** | Gravity Purple | `#A855F7` | Specific Gravity (`Densidade SG`), iSpindel/Tilt hydrometer curves |
| **Danger / Alert** | Crimson Alert | `#EF4444` | Offline badge, temperature deviation alert, destructive actions |

## 3. Typography Rules
- **Primary UI & Headings (`headlineFont` & `bodyFont`):** `Inter`, sans-serif.
  - Page Titles: `28px–32px` (`text-2xl` to `text-3xl`), `font-weight: 700`, tight tracking (`-0.025em`).
  - Card Titles: `18px–20px` (`text-lg` to `text-xl`), `font-weight: 700`.
  - Micro-labels: `10px–11px`, `font-weight: 700`, `uppercase`, wide letter-spacing (`0.08em`), `#737373`.
- **Telemetry & Numerical Readouts (`labelFont`):** `JetBrains Mono`, monospace.
  - Hero Temperature Readout: `48px–64px`, `font-weight: 700`, tabular numerals (`18.4°C`, `4.0°C`).
  - Secondary Metrics (Target, Gravity, ABV, IBU, Ramps): `14px–20px`, `font-weight: 600`, monospace.

## 4. Component Styling & Shape
- **Cards & Containers:** `border-radius: 24px` (`rounded-3xl`), background `#171717` (`bg-neutral-900/50`), border `1px solid #262626`, subtle hover border `#404040`.
- **Inner Telemetry Boxes:** `border-radius: 16px` (`rounded-2xl`), background `#0A0A0A` (`bg-neutral-950/60`), border `1px solid rgba(38,38,38,0.6)`, padding `16px`.
- **Buttons & Segmented Controls:** `border-radius: 12px` (`rounded-xl`).
  - Active Primary Button: `bg-white text-black font-bold`.
  - Mode Switcher Pill Bar: Recessed `#0A0A0A` container with 3 pills: `Modo Geladeira` (default first option), `Modo Fermentador`, `Modo Chopeira`.
- **Navigation Shell:**
  - Desktop: Left vertical sidebar (`256px` wide, `#050505` background, `#171717` active pill) with Breww logo (`B` in white rounded square + `Breww` bold title) and links: `Dispositivos`, `Histórico`, `Comparar Lotes`, `Calculadoras`, `Configurações`, `Admin`, plus user profile footer.
