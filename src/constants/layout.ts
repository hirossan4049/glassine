// Layout constants for responsive width handling
// =============================================

export const BREAKPOINTS = {
  sm: 480,
  md: 768,
} as const;

export const TIME_GRID = {
  cellWidth: {
    mobile: '48px',
    desktop: '72px',
  },
  timeCellWidth: {
    mobile: '56px',
    desktop: '72px',
  },
} as const;

export const CALENDAR_GRID = {
  monthMinWidth: {
    mobile: '100%',
    desktop: '280px',
  },
} as const;

export const RESPONSE_MATRIX = {
  stickyWidth: {
    mobile: '80px',
    desktop: '120px',
  },
  cellMinWidth: {
    dateOnly: {
      mobile: '60px',
      desktop: '80px',
    },
    datetime: {
      mobile: '40px',
      desktop: '50px',
    },
  },
} as const;

export const STATUS_DISPLAY = {
  width: {
    mobile: 'auto',
    desktop: '200px',
  },
} as const;

export const FORM = {
  nameInputMaxWidth: '400px',
  tileMinWidth: '150px',
  buttonMinWidth: {
    mobile: '36px',
    desktop: undefined,
  },
} as const;
