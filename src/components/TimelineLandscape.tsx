import { useRef, useState, useCallback, useMemo } from "preact/hooks";
import type { DayInfo } from "../types";
import { highlightedDays } from "./App";
import type {
	MonthMarker,
	WeekMarker,
	RangeMilestoneLookup,
	BaseMilestone,
	GanttBarBase,
} from "./timelineTypes";

// Milestones that get view transitions
const VIEW_TRANSITION_LABELS = new Set(["Start", "Due"]);

// Milestone styling constants
const ROW_HEIGHT = 42; // vertical spacing between rows
const GANTT_ROW_HEIGHT = 24; // height of gantt bar rows
const GANTT_BAR_HEIGHT = 18; // height of individual gantt bars
const MILESTONE_PADDING = 20; // horizontal padding inside milestone
const MILESTONE_GAP = 8; // minimum gap between milestones
const EMOJI_WIDTH = 18; // approximate emoji width

// ============================================================================
// LAYOUT TYPES
// ============================================================================

type MilestoneWithLayout = BaseMilestone & {
	row: number;
	width: number;
};

type GanttBarLandscape = GanttBarBase & {
	barRow: number;
	labelRow: number;
};

// ============================================================================
// LAYOUT FUNCTIONS
// ============================================================================

function measureTextWidth(text: string, font: string): number {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) return text.length * 7; // fallback
	ctx.font = font;
	return ctx.measureText(text).width;
}

function assignRows(
	milestones: BaseMilestone[],
	containerWidth: number,
	annotationEmojis: Record<string, string>,
): MilestoneWithLayout[] {
	const font = "600 11px Inter, -apple-system, BlinkMacSystemFont, sans-serif";

	// Calculate width for each milestone
	const withWidths = milestones.map((m) => {
		const hasEmoji = !!annotationEmojis[m.annotation];
		const textWidth = measureTextWidth(m.annotation, font);
		const width = textWidth + MILESTONE_PADDING + (hasEmoji ? EMOJI_WIDTH : 0);
		return { ...m, width };
	});

	// Sort by position (left to right)
	const sorted = [...withWidths].sort((a, b) => a.position - b.position);

	// Track occupied ranges per row
	const rowOccupancy = new Map<number, Array<{ left: number; right: number }>>();
	const result: MilestoneWithLayout[] = [];

	for (const milestone of sorted) {
		const centerPx = (milestone.position / 100) * containerWidth;
		const leftPx = centerPx - milestone.width / 2;
		const rightPx = centerPx + milestone.width / 2;

		let assignedRow = 0;
		const maxSearch = 10;

		for (let distance = 0; distance < maxSearch; distance++) {
			const rowsToTry = distance === 0 ? [0] : [distance, -distance];

			for (const row of rowsToTry) {
				const occupied = rowOccupancy.get(row) || [];
				const hasConflict = occupied.some(
					(range) =>
						!(
							rightPx + MILESTONE_GAP < range.left ||
							leftPx - MILESTONE_GAP > range.right
						),
				);

				if (!hasConflict) {
					assignedRow = row;
					break;
				}
			}

			const occupied = rowOccupancy.get(assignedRow) || [];
			const hasConflict = occupied.some(
				(range) =>
					!(
						rightPx + MILESTONE_GAP < range.left ||
						leftPx - MILESTONE_GAP > range.right
					),
			);
			if (!hasConflict) break;
		}

		const occupied = rowOccupancy.get(assignedRow) || [];
		occupied.push({ left: leftPx, right: rightPx });
		rowOccupancy.set(assignedRow, occupied);

		result.push({ ...milestone, row: assignedRow });
	}

	return result;
}

function computeGanttBars(
	rangeMilestoneLookup: RangeMilestoneLookup,
	totalDays: number,
	containerWidth: number,
): GanttBarLandscape[] {
	const font = "600 11px Inter, -apple-system, BlinkMacSystemFont, sans-serif";

	const bars: Omit<GanttBarLandscape, "barRow" | "labelRow">[] = [];
	for (const [label, range] of Object.entries(rangeMilestoneLookup)) {
		const startPosition = (range.startIndex / totalDays) * 100;
		const endPosition = (range.endIndex / totalDays) * 100;
		const textWidth = measureTextWidth(label, font);
		const labelWidth = textWidth + MILESTONE_PADDING + EMOJI_WIDTH;
		bars.push({
			label,
			startPosition,
			endPosition,
			width: endPosition - startPosition,
			color: range.color,
			emoji: range.emoji,
			labelWidth,
			startIndex: range.startIndex,
			endIndex: range.endIndex,
		});
	}

	bars.sort((a, b) => a.startPosition - b.startPosition);

	const barRowOccupancy: Array<{ left: number; right: number }>[] = [];
	const labelRowOccupancy: Array<{ left: number; right: number }>[] = [];

	const result: GanttBarLandscape[] = [];
	for (const bar of bars) {
		const barLeftPx = (bar.startPosition / 100) * containerWidth;
		const barRightPx = (bar.endPosition / 100) * containerWidth;

		let assignedBarRow = 0;
		for (let row = 0; row < barRowOccupancy.length + 1; row++) {
			const occupied = barRowOccupancy[row] || [];
			const hasConflict = occupied.some(
				(range) =>
					!(barRightPx + 4 < range.left || barLeftPx - 4 > range.right),
			);
			if (!hasConflict) {
				assignedBarRow = row;
				break;
			}
		}

		if (!barRowOccupancy[assignedBarRow]) barRowOccupancy[assignedBarRow] = [];
		barRowOccupancy[assignedBarRow].push({ left: barLeftPx, right: barRightPx });

		const labelCenterPx = (barLeftPx + barRightPx) / 2;
		const labelLeftPx = labelCenterPx - bar.labelWidth / 2;
		const labelRightPx = labelCenterPx + bar.labelWidth / 2;

		let assignedLabelRow = 0;
		for (let row = 0; row < labelRowOccupancy.length + 1; row++) {
			const occupied = labelRowOccupancy[row] || [];
			const hasConflict = occupied.some(
				(range) =>
					!(
						labelRightPx + MILESTONE_GAP < range.left ||
						labelLeftPx - MILESTONE_GAP > range.right
					),
			);
			if (!hasConflict) {
				assignedLabelRow = row;
				break;
			}
		}

		if (!labelRowOccupancy[assignedLabelRow])
			labelRowOccupancy[assignedLabelRow] = [];
		labelRowOccupancy[assignedLabelRow].push({
			left: labelLeftPx,
			right: labelRightPx,
		});

		result.push({ ...bar, barRow: assignedBarRow, labelRow: assignedLabelRow });
	}

	return result;
}

// ============================================================================
// COMPONENT
// ============================================================================

type TimelineLandscapeProps = {
	days: DayInfo[];
	baseMilestones: BaseMilestone[];
	rangeMilestoneLookup: RangeMilestoneLookup;
	monthMarkers: MonthMarker[];
	weekMarkers: WeekMarker[];
	todayIndex: number;
	todayPosition: number;
	totalDays: number;
	selectedDayIndex: number | null;
	annotationEmojis: Record<string, string>;
	onDayClick: (e: MouseEvent, day: DayInfo) => void;
	windowWidth: number;
};

export function TimelineLandscape({
	days,
	baseMilestones,
	rangeMilestoneLookup,
	monthMarkers,
	weekMarkers,
	todayIndex,
	todayPosition,
	totalDays,
	selectedDayIndex,
	annotationEmojis,
	onDayClick,
	windowWidth,
}: TimelineLandscapeProps) {
	const lineRef = useRef<HTMLDivElement>(null);
	const [hoverPosition, setHoverPosition] = useState<number | null>(null);
	const [hoverDayIndex, setHoverDayIndex] = useState<number | null>(null);

	const containerWidth = windowWidth - 120;

	// Compute milestone layouts
	const milestones = useMemo(() => {
		return assignRows(baseMilestones, containerWidth, annotationEmojis);
	}, [baseMilestones, containerWidth, annotationEmojis]);

	// Compute row range for dynamic height
	const { minRow, maxRow, milestonesHeight } = useMemo(() => {
		if (milestones.length === 0) {
			return { minRow: 0, maxRow: 0, milestonesHeight: ROW_HEIGHT };
		}
		const rows = milestones.map((m) => m.row);
		const min = Math.min(...rows);
		const max = Math.max(...rows);
		const aboveRows = max + 1;
		const belowRows = Math.abs(min);
		return {
			minRow: min,
			maxRow: max,
			milestonesHeight: (aboveRows + belowRows) * ROW_HEIGHT,
		};
	}, [milestones]);

	// Compute gantt bars
	const ganttBars = useMemo(() => {
		return computeGanttBars(rangeMilestoneLookup, totalDays, containerWidth);
	}, [rangeMilestoneLookup, totalDays, containerWidth]);

	// Compute gantt row counts
	const { ganttBarRowCount, ganttLabelRowCount } = useMemo(() => {
		if (ganttBars.length === 0) {
			return { ganttBarRowCount: 0, ganttLabelRowCount: 0 };
		}
		return {
			ganttBarRowCount: Math.max(...ganttBars.map((b) => b.barRow)) + 1,
			ganttLabelRowCount: Math.max(...ganttBars.map((b) => b.labelRow)) + 1,
		};
	}, [ganttBars]);

	const handleLineMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!lineRef.current) return;
			const rect = lineRef.current.getBoundingClientRect();
			const pos = e.clientX - rect.left;
			const size = rect.width;
			const percent = Math.max(0, Math.min(100, (pos / size) * 100));
			const dayIndex = Math.round((percent / 100) * (totalDays - 1));
			setHoverPosition(percent);
			setHoverDayIndex(dayIndex);
		},
		[totalDays],
	);

	const handleLineMouseLeave = useCallback(() => {
		setHoverPosition(null);
		setHoverDayIndex(null);
	}, []);

	return (
		<div class="timeline-view landscape">
			<div class="timeline-content-landscape">
				{/* Milestones container - stems layer (behind) then labels layer (in front) */}
				<div
					class="timeline-milestones-landscape"
					style={{ height: `${milestonesHeight}px` }}
				>
					{/* Stems layer - rendered first, appears behind */}
					{milestones.map((m) => {
						const stemHeight = 45 + (m.row - minRow) * ROW_HEIGHT;
						return (
							<div
								key={`stem-${m.index}`}
								class={`timeline-milestone-landscape ${m.color ? `colored color-${m.color}` : ""} ${highlightedDays.value.indices.has(m.index) ? "highlighted" : ""}`}
								style={{
									left: `${m.position}%`,
									...(m.color
										? { "--milestone-color": `var(--color-${m.color})` }
										: {}),
									...(highlightedDays.value.indices.has(m.index) &&
									highlightedDays.value.color
										? {
												"--highlight-color": `var(--color-${highlightedDays.value.color})`,
											}
										: {}),
								}}
							>
								<div
									class="timeline-milestone-stem-landscape"
									style={{ height: `${stemHeight}px` }}
								/>
							</div>
						);
					})}
					{/* Labels layer - rendered second, appears in front */}
					{milestones.map((m) => {
						const stemHeight = 45 + (m.row - minRow) * ROW_HEIGHT;
						const viewTransitionStyle = VIEW_TRANSITION_LABELS.has(m.annotation)
							? { viewTransitionName: `day-${m.index}` }
							: {};
						return (
							<div
								key={`label-${m.index}`}
								class={`timeline-milestone-landscape ${m.color ? `colored color-${m.color}` : ""} ${m.isToday ? "today" : ""} ${selectedDayIndex === m.index ? "selected" : ""} ${highlightedDays.value.indices.has(m.index) ? "highlighted" : ""}`}
								style={{
									left: `${m.position}%`,
									paddingBottom: `${stemHeight}px`,
									...(m.color
										? { "--milestone-color": `var(--color-${m.color})` }
										: {}),
									...(highlightedDays.value.indices.has(m.index) &&
									highlightedDays.value.color
										? {
												"--highlight-color": `var(--color-${highlightedDays.value.color})`,
											}
										: {}),
								}}
							>
								<div
									class="timeline-milestone-content-landscape timeline-label"
									style={viewTransitionStyle}
									onClick={(e) => onDayClick(e as unknown as MouseEvent, m)}
								>
									<span class="timeline-milestone-emoji">
										{annotationEmojis[m.annotation] || ""}
									</span>
									<span class="timeline-milestone-label">{m.annotation}</span>
								</div>
							</div>
						);
					})}
				</div>

				{/* Line area with months above */}
				<div class="timeline-line-area-landscape">
					{/* Month markers above the line */}
					<div class="timeline-months-landscape">
						{monthMarkers.map((m, i) => (
							<div
								key={i}
								class="timeline-month"
								style={{ left: `${m.position}%` }}
							>
								{m.month}
							</div>
						))}
					</div>

					{/* The timeline line */}
					<div
						ref={lineRef}
						class="timeline-line-landscape"
						onMouseMove={handleLineMouseMove as unknown as (e: Event) => void}
						onMouseLeave={handleLineMouseLeave}
					>
						{/* Progress fill */}
						<div
							class="timeline-progress-landscape"
							style={{ width: `${todayPosition}%` }}
						/>
						{/* Hover dot */}
						{hoverPosition !== null &&
							hoverDayIndex !== null &&
							hoverDayIndex !== todayIndex && (
								<div
									class={`timeline-hover-dot-landscape ${hoverDayIndex < (todayIndex >= 0 ? todayIndex : totalDays) ? "passed" : "future"}`}
									style={{ left: `${hoverPosition}%` }}
									onClick={(e) => {
										const day = days[hoverDayIndex];
										if (day) onDayClick(e as unknown as MouseEvent, day);
									}}
								/>
							)}
						{/* Today marker */}
						{todayIndex >= 0 && (
							<div
								class="timeline-today-landscape"
								style={{
									left: `${todayPosition}%`,
									viewTransitionName: "today-marker",
								}}
								onClick={(e) => {
									const today = days.find((d) => d.isToday);
									if (today) onDayClick(e as unknown as MouseEvent, today);
								}}
							>
								<div class="timeline-today-dot" />
							</div>
						)}
					</div>
				</div>

				{/* Week markers below the line */}
				<div class="timeline-weeks-landscape">
					{weekMarkers.map((w) => (
						<div
							key={w.week}
							class="timeline-week"
							style={{ left: `${w.position}%` }}
						>
							{w.week}
						</div>
					))}
				</div>

				{/* Gantt section for range milestones */}
				{ganttBars.length > 0 && (
					<div
						class="timeline-gantt-section-landscape"
						style={{
							height: `${ganttLabelRowCount * ROW_HEIGHT + ganttBarRowCount * GANTT_ROW_HEIGHT + 10}px`,
						}}
					>
						{/* Bars at top */}
						<div
							class="timeline-gantt-bars-landscape"
							style={{ height: `${ganttBarRowCount * GANTT_ROW_HEIGHT}px` }}
						>
							{ganttBars.map((bar) => {
								const isHighlighted = highlightedDays.value.indices.has(
									bar.startIndex,
								);
								return (
									<div
										key={`bar-${bar.label}`}
										class={`timeline-gantt-bar-landscape ${bar.color ? `colored color-${bar.color}` : ""} ${isHighlighted ? "highlighted" : ""}`}
										style={{
											left: `${bar.startPosition}%`,
											width: `${bar.width}%`,
											top: `${bar.barRow * GANTT_ROW_HEIGHT + (GANTT_ROW_HEIGHT - GANTT_BAR_HEIGHT) / 2}px`,
											height: `${GANTT_BAR_HEIGHT}px`,
											...(bar.color
												? { "--bar-color": `var(--color-${bar.color})` }
												: {}),
											...(isHighlighted && highlightedDays.value.color
												? {
														"--highlight-color": `var(--color-${highlightedDays.value.color})`,
													}
												: {}),
										}}
										onClick={(e) => {
											const day = days[bar.startIndex];
											if (day) onDayClick(e as unknown as MouseEvent, day);
										}}
									/>
								);
							})}
						</div>
						{/* Labels below bars with stems going up from center of range */}
						<div
							class="timeline-gantt-labels-landscape"
							style={{ height: `${ganttLabelRowCount * ROW_HEIGHT}px` }}
						>
							{ganttBars.map((bar) => {
								const isHighlighted = highlightedDays.value.indices.has(
									bar.startIndex,
								);
								const stemHeight = 20 + bar.labelRow * ROW_HEIGHT;
								const centerPosition =
									(bar.startPosition + bar.endPosition) / 2;
								return (
									<div
										key={`label-${bar.label}`}
										class={`timeline-gantt-item-landscape ${bar.color ? `colored color-${bar.color}` : ""} ${isHighlighted ? "highlighted" : ""}`}
										style={{
											left: `${centerPosition}%`,
											top: 0,
											...(bar.color
												? { "--bar-color": `var(--color-${bar.color})` }
												: {}),
											...(isHighlighted && highlightedDays.value.color
												? {
														"--highlight-color": `var(--color-${highlightedDays.value.color})`,
													}
												: {}),
										}}
									>
										<div
											class="timeline-gantt-stem-landscape"
											style={{ height: `${stemHeight}px` }}
										/>
										<div
											class="timeline-gantt-label-content-landscape timeline-label"
											onClick={(e) => {
												const day = days[bar.startIndex];
												if (day) onDayClick(e as unknown as MouseEvent, day);
											}}
										>
											<span class="timeline-gantt-label-emoji">
												{bar.emoji}
											</span>
											<span class="timeline-gantt-label-text">{bar.label}</span>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
