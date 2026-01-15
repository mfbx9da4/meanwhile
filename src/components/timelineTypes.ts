import type { DayInfo } from "../types";

export type MonthMarker = {
	month: string;
	year: number;
	position: number;
};

export type WeekMarker = {
	week: number;
	position: number;
};

export type GanttBarBase = {
	label: string;
	startPosition: number;
	endPosition: number;
	width: number;
	color?: string;
	emoji: string;
	labelWidth: number;
	startIndex: number;
	endIndex: number;
};

export type RangeMilestoneLookup = Record<
	string,
	{ startIndex: number; endIndex: number; color?: string; emoji: string }
>;

export type BaseMilestone = DayInfo & { position: number };
