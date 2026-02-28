// Pregnancy months: split total days into 9 equal sections
export const NUM_MONTHS = 9;

export function getMonthStart(month: number, totalDays: number): number {
	return Math.round((month * totalDays) / NUM_MONTHS);
}

export function getMonthForDay(dayIndex: number, totalDays: number): number {
	return Math.min(
		Math.floor((dayIndex * NUM_MONTHS) / totalDays),
		NUM_MONTHS - 1,
	);
}

// Layout constants - single source of truth for CSS and JS
export const LAYOUT = {
	// Padding around main content areas
	padding: 10,

	// Grid gaps
	gridGap: 3,
	weeklyGridGap: 2,

	// Weekly view label dimensions
	weekLabelWidth: 42,
	monthLabelHeight: 16,
	dayLabelHeight: 20,
};
