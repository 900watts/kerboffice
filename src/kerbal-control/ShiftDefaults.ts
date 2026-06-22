/**
 * ShiftDefaults — Single source of truth for shift assignment defaults.
 *
 * Both KerbalStore and ShiftConfig import from here so they always agree
 * on the canonical day/night rosters. This eliminates the bug where
 * one module had a different default than the other, causing presence
 * inconsistencies after page refresh.
 */

export const DEFAULT_DAY_SHIFT: string[] = [
  'Jebediah',
  'Bill',
  'Valentina',
  'Bob',
  'Wernher',
];

export const DEFAULT_NIGHT_SHIFT: string[] = [
  'Bobak',
  'Gene',
  'Mortimer',
  'Linus',
  'Walt',
];
