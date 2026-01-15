import { useMemo } from "preact/hooks";
import type { DayInfo } from "../types";
import type { Milestone } from "./App";
import { TimelineLandscape } from "./TimelineLandscape";
import { TimelinePortrait } from "./TimelinePortrait";
import type {
	MonthMarker,
	WeekMarker,
	RangeMilestoneLookup,
	BaseMilestone,
} from "./timelineTypes";

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

// ============================================================================
// SHARED UTILITY FUNCTIONS
// ============================================================================

function getDaysBetween(start: Date, end: Date): number {
	const msPerDay = 1000 * 60 * 60 * 24;
	return Math.ceil((end.getTime() - start.getTime()) / msPerDay);
}

function buildRangeMilestoneLookup(
	milestones: Milestone[],
	startDate: Date,
): RangeMilestoneLookup {
	const lookup: RangeMilestoneLookup = {};
	for (const m of milestones) {
		if (m.endDate) {
			const startIndex = getDaysBetween(startDate, m.date);
			const endIndex = getDaysBetween(startDate, m.endDate);
			lookup[m.label] = {
				startIndex,
				endIndex,
				color: m.color,
				emoji: m.emoji,
			};
		}
	}
	return lookup;
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type TimelineViewProps = {
	days: DayInfo[];
	windowSize: { width: number; height: number };
	startDate: Date;
	onDayClick: (e: MouseEvent, day: DayInfo) => void;
	selectedDayIndex: number | null;
	annotationEmojis: Record<string, string>;
	milestones: Milestone[];
};

export function TimelineView({
	days,
	windowSize,
	startDate,
	onDayClick,
	selectedDayIndex,
	annotationEmojis,
	milestones,
}: TimelineViewProps) {
	const totalDays = days.length;
	const isLandscape = windowSize.width > windowSize.height;

	// Build range milestone lookup from passed milestones
	const rangeMilestoneLookup = useMemo(() => {
		return buildRangeMilestoneLookup(milestones, startDate);
	}, [milestones, startDate]);

	// Find today's index
	const todayIndex = days.findIndex((d) => d.isToday);
	const todayPosition = todayIndex >= 0 ? (todayIndex / totalDays) * 100 : -1;

	// Get month markers
	const monthMarkers = useMemo((): MonthMarker[] => {
		const markers: MonthMarker[] = [];
		let lastMonth = -1;

		for (let i = 0; i < totalDays; i++) {
			const date = addDays(startDate, i);
			const month = date.getMonth();
			if (month !== lastMonth) {
				markers.push({
					month: MONTHS[month],
					year: date.getFullYear(),
					position: (i / totalDays) * 100,
				});
				lastMonth = month;
			}
		}
		return markers;
	}, [totalDays, startDate]);

	// Get week markers (pregnancy weeks 1-40)
	const weekMarkers = useMemo((): WeekMarker[] => {
		const markers: WeekMarker[] = [];
		for (let i = 0; i < totalDays; i += 7) {
			const weekNum = Math.floor(i / 7) + 1;
			markers.push({
				week: weekNum,
				position: (i / totalDays) * 100,
			});
		}
		return markers;
	}, [totalDays]);

	// Get base milestones (non-range) with positions - shared by both views
	const baseMilestones = useMemo((): BaseMilestone[] => {
		return days
			.filter(
				(d) =>
					d.annotation &&
					d.annotation !== "Today" &&
					!rangeMilestoneLookup[d.annotation],
			)
			.map((d) => ({
				...d,
				position: (d.index / totalDays) * 100,
			}));
	}, [days, totalDays, rangeMilestoneLookup]);

	// Render appropriate view
	if (isLandscape) {
		return (
			<TimelineLandscape
				days={days}
				baseMilestones={baseMilestones}
				rangeMilestoneLookup={rangeMilestoneLookup}
				monthMarkers={monthMarkers}
				weekMarkers={weekMarkers}
				todayIndex={todayIndex}
				todayPosition={todayPosition}
				totalDays={totalDays}
				selectedDayIndex={selectedDayIndex}
				annotationEmojis={annotationEmojis}
				onDayClick={onDayClick}
				windowWidth={windowSize.width}
			/>
		);
	}

	return (
		<TimelinePortrait
			days={days}
			baseMilestones={baseMilestones}
			rangeMilestoneLookup={rangeMilestoneLookup}
			monthMarkers={monthMarkers}
			weekMarkers={weekMarkers}
			todayIndex={todayIndex}
			todayPosition={todayPosition}
			totalDays={totalDays}
			selectedDayIndex={selectedDayIndex}
			annotationEmojis={annotationEmojis}
			onDayClick={onDayClick}
			windowSize={windowSize}
		/>
	);
}
