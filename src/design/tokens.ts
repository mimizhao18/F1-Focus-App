// The app's design values (no React), so they can be tested. Every screen reads them through useTheme() / makeStyles().
// Direction: a "timing screen", refined. Dark and precise, one F1 red accent (primary action, active state, progress),
// 4 px corners, hairline dividers, monospace numerals for every stat, timer, XP and credit amount.

export const colors = {
  // four neutral steps, darkest to lightest
  background: '#101012',
  surface: '#18181B',
  raised: '#202024',
  border: '#2A2A2F',
  // three text levels
  text: '#EDEDF0',
  textSecondary: '#B5B5BD',
  textMuted: '#9A9AA3',
  // the one accent, plus the colors that go on and with it
  accent: '#E10600',
  /** Text and icons placed on the accent (white). */
  accentText: '#FFFFFF',
  /** The accent lightened so that small text and icons on the dark surfaces still pass WCAG AA. */
  accentOnDark: '#FF6B63',
  /** A dark red tint of the accent: the idle fill of the Home tab. */
  accentTint: '#2A1513',
  positive: '#3DDC84',
  /** The yellow of a yellow flag: used only for race warnings. */
  flag: '#FFD60A',
  /** The letterbox around the phone-sized app column in a web browser. */
  backdrop: '#050505',
  /** The black housing of the start lights gantry (its lights use `accentTint` when off and `accent` when lit). */
  gantry: '#060607',

  /** The credits coin. */
  coin: '#F4F4F5',
} as const;

/** UI font (Inter) and numerals font (JetBrains Mono, whose digits are all the same width). Only weights 400, 500 and 600. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
} as const;

/**
 * The "glass" look used on Home: a faint white fill that is a little brighter at the top, and an edge that catches
 * light along the top. Opacities are 0 to 1 and are applied to `tint`.
 */
export const glass = {
  tint: '#FFFFFF',
  fillTop: 0.1,
  fillBottom: 0.03,
  edgeTop: 0.28,
  edgeBottom: 0.06,
  /** A hairline inside a glass panel. */
  divider: 'rgba(255,255,255,0.10)',
  /** The dark layer behind a dialog. */
  scrim: 'rgba(0,0,0,0.7)',
  /** Corner brackets and similar thin marks. */
  mark: 0.4,
  /** The glow behind the car: the strongest opacity of the livery color. */
  ambient: 0.22,
} as const;

export const theme = {
  colors,
  glass,
  /** An 8 px grid (4 for tight gaps, 2 to stack a label on its number). Screens are padded by `screen`. */
  spacing: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, screen: 16 },
  radius: {
    /** Buttons, chips, inputs and cards. */
    control: 4,
    /** Large panels, at most. */
    panel: 6,
    /** Dots and tiny badges only. */
    dot: 999,
  },
  border: { hairline: 1, selected: 1.5 },
  /** Fixed sizes: every touch target is at least `touch`, buttons and rows are taller. */
  size: { touch: 44, control: 48, row: 56, tabBar: 48, progress: 4, icon: 22, heroCompact: 176, hero: 260, dialog: 340, weekBar: 64, thumbWidth: 10, thumbHeight: 28, flag: 24, raceReserved: 400, raceReservedCompact: 330, iconCar: 180, cardCar: 76, cardCarWide: 170, gantry: 340, primary: 56, tick: 8, tickRadius: 3, chevron: 14, swipeStart: 16, swipe: 64, swipeSpeed: 0.5, line: 2 },
  opacity: { disabled: 0.4, dimmed: 0.5, unaffordable: 0.68, pressed: 0.85 },
  /** Text styles, ready to spread into a style object. Numbers (stats, timers, XP, credits) use the mono ones. */
  typography: {
    /** The race countdown: the biggest thing in the app. */
    timer: { fontFamily: fonts.monoSemibold, fontSize: 72, lineHeight: 76, letterSpacing: -2 },
    display: { fontFamily: fonts.monoSemibold, fontSize: 56, lineHeight: 60, letterSpacing: -1.5 },
    title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
    heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
    body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
    caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
    /** Small uppercase labels, like a telemetry screen. */
    label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
    /** The small text of Home's top bar and similar: labels and numbers share one size. */
    metaLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
    metaValue: { fontFamily: fonts.monoMedium, fontSize: 12, lineHeight: 16 },
    /** Tiny captions, labels and numbers (tab labels, units, chart minutes). */
    micro: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14 },
    microLabel: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
    microMono: { fontFamily: fonts.monoMedium, fontSize: 11, lineHeight: 16 },
    /** The label of the Race (Home) tab and the wording of the big call-to-action buttons. */
    tabHome: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0.8, textTransform: 'uppercase' },
    cta: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, letterSpacing: 1.5, textTransform: 'uppercase' },
    button: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
    statLarge: { fontFamily: fonts.monoSemibold, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
    stat: { fontFamily: fonts.monoMedium, fontSize: 20, lineHeight: 26 },
    /** Your available credits in the top right corner of the Garage, Store and livery screens. */
    statCompact: { fontFamily: fonts.monoMedium, fontSize: 16, lineHeight: 22 },
    statSmall: { fontFamily: fonts.monoMedium, fontSize: 14, lineHeight: 20 },
  },
} as const;

export type Theme = typeof theme;
