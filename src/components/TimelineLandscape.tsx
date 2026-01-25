import {
	useRef,
	useState,
	useCallback,
	useMemo,
	useLayoutEffect,
} from "preact/hooks";
import type { DayInfo } from "../types";
import { highlightedDays } from "./App";
import type {
	MonthMarker,
	WeekMarker,
	RangeMilestoneLookup,
	BaseMilestone,
	GanttBarBase,
} from "./timelineTypes";

// Milestone styling constants
const ROW_HEIGHT = 42; // vertical spacing between stacked milestones
const GANTT_ROW_HEIGHT = 24; // height of gantt bar rows
const GANTT_BAR_HEIGHT = 18; // height of individual gantt bars
const MILESTONE_PADDING = 20; // horizontal padding inside milestone
const MILESTONE_GAP = 8; // minimum gap between milestones
const EMOJI_WIDTH = 18; // approximate emoji width
const EXPANDED_WIDTH = 120; // width when expanded
const COLLAPSED_WIDTH = 24; // width when collapsed (emoji only)
const BASE_STEM_HEIGHT = 45; // minimum stem height

// ============================================================================
// LAYOUT TYPES
// ============================================================================

type LandscapeLayoutInput = {
	left: number; // X position in pixels (center of milestone)
	width: number; // Current width of the milestone
	isColoured: boolean;
};

type LandscapeLayoutOutput = {
	top: number; // Y offset from baseline (0 = closest to line, positive = higher up)
	collapsed: boolean;
};

type LandscapeLayoutOptions = {
	maxHeight: number;
	expandedWidth?: number;
	collapsedWidth?: number;
};

type MilestoneWithLayout = BaseMilestone & {
	topPx: number;
	width: number;
	expanded: boolean;
};

type GanttBarLandscape = GanttBarBase & {
	barRow: number;
	labelTop: number;
	labelExpanded: boolean;
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

// Check if two items overlap horizontally (with gap)
function overlapsX(
	a: { left: number; width: number },
	b: { left: number; width: number },
): boolean {
	const aLeft = a.left - a.width / 2;
	const aRight = a.left + a.width / 2;
	const bLeft = b.left - b.width / 2;
	const bRight = b.left + b.width / 2;
	// Two intervals overlap if neither is entirely to the left of the other
	return aRight + MILESTONE_GAP > bLeft && bRight + MILESTONE_GAP > aLeft;
}

/**
 * Core layout algorithm for landscape milestones.
 * Items have fixed X positions and variable Y positions (stacking vertically).
 * When vertical space is exceeded, items are collapsed (width reduced) to decrease horizontal overlap.
 */
function layoutLandscapeMilestonesCore<T extends LandscapeLayoutInput>(
	unsortedMilestones: T[],
	opts: LandscapeLayoutOptions,
): { layouts: (T & LandscapeLayoutOutput)[]; ok: boolean } {
	const expandedWidth = opts.expandedWidth ?? EXPANDED_WIDTH;
	const collapsedWidth = opts.collapsedWidth ?? COLLAPSED_WIDTH;
	const maxHeight = opts.maxHeight;

	// Sort by left position (left to right)
	const layouts: (T & LandscapeLayoutOutput & { width: number })[] = [
		...unsortedMilestones,
	]
		.sort((a, b) => a.left - b.left)
		.map((ms) => ({
			...ms,
			width: expandedWidth,
			top: 0,
			collapsed: false,
		}));

	const n = layouts.length;

	const runPass = () => {
		let maxTop = 0;

		for (let i = 0; i < n; i++) {
			const base = layouts[i];

			// Find all previously placed milestones that overlap horizontally
			const overlapping: { top: number }[] = [];
			for (let j = 0; j < i; j++) {
				const other = layouts[j];
				if (overlapsX(base, other)) {
					overlapping.push({ top: other.top });
				}
			}

			// Find the first available Y position (closest to 0)
			// Sort occupied positions and find first gap
			if (overlapping.length === 0) {
				base.top = 0;
			} else {
				// Occupied Y positions (each milestone occupies [top, top + ROW_HEIGHT])
				const occupied = overlapping
					.map((o) => o.top)
					.sort((a, b) => a - b);

				// Try position 0 first
				let foundPosition = false;
				if (occupied[0] >= ROW_HEIGHT) {
					base.top = 0;
					foundPosition = true;
				}

				// Look for gaps between occupied positions
				if (!foundPosition) {
					for (let k = 0; k < occupied.length - 1; k++) {
						const gapStart = occupied[k] + ROW_HEIGHT;
						const gapEnd = occupied[k + 1];
						if (gapEnd - gapStart >= ROW_HEIGHT) {
							base.top = gapStart;
							foundPosition = true;
							break;
						}
					}
				}

				// Place after all existing
				if (!foundPosition) {
					base.top = occupied[occupied.length - 1] + ROW_HEIGHT;
				}
			}

			if (base.top + ROW_HEIGHT > maxTop) {
				maxTop = base.top + ROW_HEIGHT;
			}
		}

		return maxTop;
	};

	// Collapse loop - iterate until layout fits or no more candidates
	for (let iter = 0; iter < n + 2; iter++) {
		const maxTop = runPass();

		if (maxTop <= maxHeight) {
			return { layouts, ok: true };
		}

		// Find candidate to collapse: items that overlap horizontally with the topmost items
		const findCandidate = (): (T & LandscapeLayoutOutput & { width: number }) | null => {
			const expanded = layouts.filter((ms) => !ms.collapsed);
			if (expanded.length === 0) return null;

			// Find the maximum top position
			const topmost = Math.max(...layouts.map((ms) => ms.top));

			// Find all milestones at the topmost position
			const atTop = layouts.filter((ms) => ms.top === topmost);

			// Find all expanded milestones that overlap horizontally with those at top
			const candidates = new Set<T & LandscapeLayoutOutput & { width: number }>();
			for (const ms of atTop) {
				for (const other of expanded) {
					if (overlapsX(ms, other)) {
						candidates.add(other);
					}
				}
			}

			if (candidates.size === 0) return null;

			// Collapse priority: non-colored first, then leftmost
			const arr = Array.from(candidates);
			const nonColoured = arr.filter((ms) => !ms.isColoured);
			const coloured = arr.filter((ms) => ms.isColoured);

			const findLeftmost = (
				list: (T & LandscapeLayoutOutput & { width: number })[],
			) => {
				let best = list[0];
				for (const ms of list) {
					if (ms.left < best.left) best = ms;
				}
				return best;
			};

			if (nonColoured.length > 0) return findLeftmost(nonColoured);
			if (coloured.length > 0) return findLeftmost(coloured);
			return arr[0];
		};

		const candidate = findCandidate();
		if (!candidate) {
			return { layouts, ok: false };
		}

		candidate.collapsed = true;
		candidate.width = collapsedWidth;
	}

	return { layouts, ok: false };
}

/**
 * Wrapper that prepares input and processes output for landscape milestone layout.
 */
function layoutLandscapeMilestones(
	milestones: BaseMilestone[],
	containerWidth: number,
	maxHeight: number,
	annotationEmojis: Record<string, string>,
): MilestoneWithLayout[] {
	if (milestones.length === 0 || containerWidth <= 0 || maxHeight <= 0) {
		return [];
	}

	const font = "600 11px Inter, -apple-system, BlinkMacSystemFont, sans-serif";

	// Calculate width and center position for each milestone
	const inputLayouts = milestones.map((m) => {
		const hasEmoji = !!annotationEmojis[m.annotation];
		const textWidth = measureTextWidth(m.annotation, font);
		const naturalWidth = textWidth + MILESTONE_PADDING + (hasEmoji ? EMOJI_WIDTH : 0);
		const centerPx = (m.position / 100) * containerWidth;

		return {
			...m,
			left: centerPx,
			width: Math.min(naturalWidth, EXPANDED_WIDTH),
			isColoured: !!m.color,
		};
	});

	const { layouts } = layoutLandscapeMilestonesCore(inputLayouts, {
		maxHeight,
		expandedWidth: EXPANDED_WIDTH,
		collapsedWidth: COLLAPSED_WIDTH,
	});

	return layouts.map((layout) => ({
		...layout,
		topPx: layout.top,
		expanded: !layout.collapsed,
	}));
}

function computeGanttBars(
	rangeMilestoneLookup: RangeMilestoneLookup,
	totalDays: number,
	containerWidth: number,
	maxLabelHeight: number,
): GanttBarLandscape[] {
	const font = "600 11px Inter, -apple-system, BlinkMacSystemFont, sans-serif";

	const bars: Omit<GanttBarLandscape, "barRow" | "labelTop" | "labelExpanded">[] = [];
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

	// Assign bar rows (for the actual range bars - these don't collapse)
	const barRowOccupancy: Array<{ left: number; right: number }>[] = [];
	const barsWithRows: (typeof bars[number] & { barRow: number })[] = [];

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

		barsWithRows.push({ ...bar, barRow: assignedBarRow });
	}

	// Use collapsing algorithm for labels
	// Note: we use barWidth to preserve the original bar width (percentage) since the layout
	// algorithm will overwrite 'width' with label width (pixels)
	const labelInputs = barsWithRows.map((bar) => {
		const centerPx = ((bar.startPosition + bar.endPosition) / 2 / 100) * containerWidth;
		return {
			...bar,
			barWidth: bar.width, // preserve original bar width
			left: centerPx,
			width: EXPANDED_WIDTH,
			isColoured: !!bar.color,
		};
	});

	const { layouts: labelLayouts } = layoutLandscapeMilestonesCore(labelInputs, {
		maxHeight: maxLabelHeight,
		expandedWidth: EXPANDED_WIDTH,
		collapsedWidth: COLLAPSED_WIDTH,
	});

	return labelLayouts.map((layout) => ({
		...layout,
		width: layout.barWidth, // restore original bar width
		labelTop: layout.top,
		labelExpanded: !layout.collapsed,
	}));
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
	windowHeight: number;
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
	windowHeight,
}: TimelineLandscapeProps) {
	const lineRef = useRef<HTMLDivElement>(null);
	const milestonesContainerRef = useRef<HTMLDivElement>(null);
	const [hoverPosition, setHoverPosition] = useState<number | null>(null);
	const [hoverDayIndex, setHoverDayIndex] = useState<number | null>(null);

	// Measure available height for milestones from DOM
	const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

	useLayoutEffect(() => {
		if (milestonesContainerRef.current) {
			// Use a portion of window height as max milestone area
			// This gives us the constraint for when to start collapsing
			const maxAvailable = Math.floor(windowHeight * 0.35);
			setMeasuredHeight(maxAvailable);
		}
	}, [windowHeight]);

	const containerWidth = windowWidth - 120;
	const maxMilestoneHeight = measuredHeight ?? Math.floor(windowHeight * 0.35);

	// Compute milestone layouts using the new algorithm
	const milestones = useMemo(() => {
		return layoutLandscapeMilestones(
			baseMilestones,
			containerWidth,
			maxMilestoneHeight,
			annotationEmojis,
		);
	}, [baseMilestones, containerWidth, maxMilestoneHeight, annotationEmojis]);

	// Compute actual height needed based on layout results
	const milestonesHeight = useMemo(() => {
		if (milestones.length === 0) return ROW_HEIGHT;
		const maxTop = Math.max(...milestones.map((m) => m.topPx));
		return maxTop + ROW_HEIGHT + BASE_STEM_HEIGHT;
	}, [milestones]);

	// Max height for gantt labels (similar constraint as milestones)
	const maxGanttLabelHeight = Math.floor(windowHeight * 0.25);

	// Compute gantt bars
	const ganttBars = useMemo(() => {
		return computeGanttBars(rangeMilestoneLookup, totalDays, containerWidth, maxGanttLabelHeight);
	}, [rangeMilestoneLookup, totalDays, containerWidth, maxGanttLabelHeight]);

	// Compute gantt dimensions
	const { ganttBarRowCount, ganttLabelsHeight } = useMemo(() => {
		if (ganttBars.length === 0) {
			return { ganttBarRowCount: 0, ganttLabelsHeight: 0 };
		}
		const maxLabelTop = Math.max(...ganttBars.map((b) => b.labelTop));
		return {
			ganttBarRowCount: Math.max(...ganttBars.map((b) => b.barRow)) + 1,
			ganttLabelsHeight: maxLabelTop + ROW_HEIGHT,
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
					ref={milestonesContainerRef}
					class="timeline-milestones-landscape"
					style={{ height: `${milestonesHeight}px` }}
				>
					{/* Stems layer - rendered first, appears behind */}
					{milestones.map((m) => {
						const stemHeight = BASE_STEM_HEIGHT + m.topPx;
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
						const stemHeight = BASE_STEM_HEIGHT + m.topPx;
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
								{m.expanded ? (
									<div
										class="timeline-milestone-content-landscape timeline-label"
										onClick={(e) => onDayClick(e as unknown as MouseEvent, m)}
									>
										<span class="timeline-milestone-emoji">
											{annotationEmojis[m.annotation] || ""}
										</span>
										<span class="timeline-milestone-label">{m.annotation}</span>
									</div>
								) : (
									<div
										class="timeline-milestone-emoji-only"
										onClick={(e) => onDayClick(e as unknown as MouseEvent, m)}
									>
										<span class="timeline-milestone-emoji">
											{annotationEmojis[m.annotation] || ""}
										</span>
									</div>
								)}
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
							height: `${ganttLabelsHeight + ganttBarRowCount * GANTT_ROW_HEIGHT + 10}px`,
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
							style={{ height: `${ganttLabelsHeight}px` }}
						>
							{ganttBars.map((bar) => {
								const isHighlighted = highlightedDays.value.indices.has(
									bar.startIndex,
								);
								const stemHeight = 20 + bar.labelTop;
								const centerPosition =
									(bar.startPosition + bar.endPosition) / 2;
								return (
									<div
										key={`label-${bar.label}`}
										class={`timeline-gantt-item-landscape ${bar.color ? `colored color-${bar.color}` : ""} ${isHighlighted ? "highlighted" : ""} ${bar.labelExpanded ? "expanded" : "collapsed"}`}
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
										{bar.labelExpanded ? (
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
										) : (
											<div
												class="timeline-gantt-emoji-only"
												onClick={(e) => {
													const day = days[bar.startIndex];
													if (day) onDayClick(e as unknown as MouseEvent, day);
												}}
											>
												<span class="timeline-gantt-label-emoji">
													{bar.emoji}
												</span>
											</div>
										)}
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
