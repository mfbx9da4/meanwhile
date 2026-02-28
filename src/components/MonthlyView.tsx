import { useMemo } from "preact/hooks";
import type { DayInfo } from "../types";
import { LAYOUT, NUM_MONTHS, getMonthStart } from "../constants";
import { highlightedDays } from "./App";

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

const DAY_LABELS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS_MON_SHORT = ["M", "T", "W", "T", "F", "S", "S"];

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

type MonthlyViewProps = {
	days: DayInfo[];
	windowSize: { width: number; height: number };
	isLandscape: boolean;
	startDate: Date;
	onDayClick: (e: MouseEvent, day: DayInfo) => void;
	selectedDayIndex: number | null;
};

export function MonthlyView({
	days,
	windowSize,
	isLandscape,
	startDate,
	onDayClick,
	selectedDayIndex,
}: MonthlyViewProps) {
	const totalDays = days.length;

	const monthSections = useMemo(() => {
		const sections: {
			monthNum: number;
			weeks: (DayInfo | null)[][];
			monthLabels: Map<number, string>;
		}[] = [];

		for (let m = 0; m < NUM_MONTHS; m++) {
			const monthStartDay = getMonthStart(m, totalDays);
			const monthEndDay = getMonthStart(m + 1, totalDays) - 1;
			const monthDayCount = monthEndDay - monthStartDay + 1;
			// Monday-based: (getDay() + 6) % 7 gives 0=Mon, 6=Sun
			const monthStartDow =
				(addDays(startDate, monthStartDay).getDay() + 6) % 7;
			const numWeeks = Math.ceil((monthStartDow + monthDayCount) / 7);

			const weeks: (DayInfo | null)[][] = [];
			for (let week = 0; week < numWeeks; week++) {
				const weekDays: (DayInfo | null)[] = [];
				for (let dow = 0; dow < 7; dow++) {
					const dayInMonth = week * 7 + dow - monthStartDow;
					const dayIndex = monthStartDay + dayInMonth;
					if (
						dayInMonth >= 0 &&
						dayInMonth < monthDayCount &&
						dayIndex < totalDays
					) {
						weekDays.push(days[dayIndex]);
					} else {
						weekDays.push(null);
					}
				}
				weeks.push(weekDays);
			}

			// Calendar month labels: only on the row/col containing the 1st of each month
			const monthLabels = new Map<number, string>();
			for (let d = monthStartDay; d <= monthEndDay; d++) {
				const date = addDays(startDate, d);
				if (date.getDate() === 1) {
					const weekInSection = Math.floor(
						(monthStartDow + d - monthStartDay) / 7,
					);
					monthLabels.set(weekInSection, MONTHS[date.getMonth()]);
				}
			}

			sections.push({ monthNum: m, weeks, monthLabels });
		}
		return sections;
	}, [days, totalDays, startDate]);

	const maxWeeks = useMemo(() => {
		let max = 0;
		for (const section of monthSections) {
			max = Math.max(max, section.weeks.length);
		}
		return max;
	}, [monthSections]);

	const { cellSize, labelSize, gap } = useMemo(() => {
		const { padding, weeklyGridGap, weekLabelWidth } = LAYOUT;

		if (isLandscape) {
			const dayLabelColWidth = 28;
			const calLabelRowHeight = 12;
			const sectionGap = 8;

			const availableHeight =
				windowSize.height -
				padding * 2 -
				calLabelRowHeight;
			// 7 grid rows + 1 bottom row for month number (same height as cell)
			const cellSizeFromHeight =
				(availableHeight - weeklyGridGap * 6) / 8;

			let totalWeekCols = 0;
			for (const section of monthSections) {
				totalWeekCols += section.weeks.length;
			}
			const hPadding = 4;
			const availableWidth =
				windowSize.width -
				hPadding * 2 -
				dayLabelColWidth -
				sectionGap * 8;
			const cellSizeFromWidth =
				(availableWidth - weeklyGridGap * (totalWeekCols - 9)) /
				totalWeekCols;

			const size = Math.min(cellSizeFromHeight, cellSizeFromWidth);
			const cellSize = Math.max(Math.floor(size), 8);
			return {
				cellSize,
				labelSize: Math.max(8, Math.min(11, cellSize * 0.4)),
				gap: weeklyGridGap,
			};
		} else {
			// Portrait monthly
			const sectionGap = 8;
			const availableWidth =
				windowSize.width - padding * 2 - weekLabelWidth * 2;
			const numCols = 7;

			let totalMonthWeeks = 0;
			for (const section of monthSections) {
				totalMonthWeeks += section.weeks.length;
			}

			const headerHeight = 16;
			const availableHeight =
				windowSize.height -
				padding * 2 -
				headerHeight -
				sectionGap * (NUM_MONTHS - 1) -
				weeklyGridGap;
			const numRows = totalMonthWeeks;

			const maxCellWidth =
				(availableWidth - weeklyGridGap * (numCols - 1)) / numCols;
			const maxCellHeight =
				(availableHeight - weeklyGridGap * (numRows - 1)) / numRows;
			const size = Math.min(maxCellWidth, maxCellHeight);
			const cellSize = Math.max(Math.floor(size), 8);
			return {
				cellSize,
				labelSize: Math.max(8, Math.min(11, cellSize * 0.4)),
				gap: weeklyGridGap,
			};
		}
	}, [windowSize, isLandscape, monthSections, maxWeeks]);

	const usedDayLabelsMon =
		cellSize < 20 ? DAY_LABELS_MON_SHORT : DAY_LABELS_MON;

	const getMonthNumberTransitionName = (monthNum: number) =>
		`month-number-${monthNum}`;

	if (isLandscape) {
		const dayLabelColWidth = 28;
		const calLabelRowHeight = 12;
		const sectionGap = 8;
		const gridHeight = 7 * cellSize + 6 * gap;

		return (
			<div
				class="weekly-view landscape monthly-sections-landscape"
				style={{
					padding: `${LAYOUT.padding}px 4px`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: "100%",
				}}
			>
				<div
					class="landscape-monthly-wrapper"
					style={{ gap: `${sectionGap}px` }}
				>
					{/* Day labels column (Mon-Sun) */}
					<div
						class="weekly-day-labels"
						style={{
							gap: `${gap}px`,
							marginTop: `${calLabelRowHeight}px`,
							width: `${dayLabelColWidth}px`,
						}}
					>
						{usedDayLabelsMon.map((label, i) => (
							<span
								key={i}
								class="weekly-day-label"
								style={{
									height: `${cellSize}px`,
									fontSize: `${labelSize}px`,
								}}
							>
								{label}
							</span>
						))}
					</div>

					{/* 9 month sections */}
					{monthSections.map((section) => (
						<div
							key={section.monthNum}
							class="landscape-monthly-section"
							style={{
								width: `${section.weeks.length * cellSize + (section.weeks.length - 1) * gap}px`,
							}}
						>
							<div
								class="landscape-monthly-cal-labels"
								style={{
									gap: `${gap}px`,
									fontSize: `${labelSize}px`,
								}}
							>
								{section.weeks.map((_, weekIdx) => (
									<span
										key={weekIdx}
										class="landscape-monthly-cal-label"
										style={{ width: `${cellSize}px` }}
									>
										{section.monthLabels.get(weekIdx) || ""}
									</span>
								))}
							</div>
							<div
								class="weekly-grid"
								style={{
									gridTemplateColumns: `repeat(${section.weeks.length}, ${cellSize}px)`,
									gridTemplateRows: `repeat(7, ${cellSize}px)`,
									gap: `${gap}px`,
									height: `${gridHeight}px`,
								}}
							>
								{Array.from({ length: 7 }, (_, dayOfWeek) =>
									section.weeks.map((week, weekIdx) => {
										const day = week[dayOfWeek];
										return day ? (
											<div
												key={`${weekIdx}-${dayOfWeek}`}
												class={`weekly-cell ${day.passed ? "passed" : "future"} ${day.color ? "milestone" : ""} ${day.isUncoloredMilestone || day.color === "subtle" ? "uncolored-milestone" : ""} ${day.isOddWeek ? "odd-week" : "even-week"} ${day.isToday ? "today" : ""} ${selectedDayIndex === day.index ? "selected" : ""} ${highlightedDays.value.indices.has(day.index) ? "highlighted" : ""}`}
												style={{
													...(day.isToday
														? {
																viewTransitionName:
																	"today-marker",
															}
														: {}),
													gridColumn: weekIdx + 1,
													gridRow: dayOfWeek + 1,
													...(day.color &&
													day.color !== "subtle"
														? day.isToday
															? {
																	"--day-target-bg": `var(--color-${day.color})`,
																}
															: {
																	background: `var(--color-${day.color})`,
																}
														: {}),
													...(highlightedDays.value.indices.has(
														day.index,
													) &&
													highlightedDays.value.color
														? {
																"--highlight-color": `var(--color-${highlightedDays.value.color})`,
															}
														: {}),
												}}
												onClick={(e) =>
													onDayClick(
														e as unknown as MouseEvent,
														day,
													)
												}
											/>
										) : (
											<div
												key={`${weekIdx}-${dayOfWeek}`}
												class="weekly-cell empty"
												style={{
													gridColumn: weekIdx + 1,
													gridRow: dayOfWeek + 1,
												}}
											/>
										);
									}),
								)}
							</div>
							<div
								class="landscape-monthly-month-num"
								style={{
									height: `${cellSize}px`,
									width: `${cellSize}px`,
									fontSize: `${labelSize}px`,
									viewTransitionName:
										getMonthNumberTransitionName(
											section.monthNum,
										),
								}}
							>
								{section.monthNum}
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	// Portrait monthly: separate sections per month, each with its own grid
	const monthNumFontSize = `${Math.max(labelSize * 1.2, 10)}px`;
	return (
		<div
			class="weekly-view portrait monthly-sections"
			style={{ padding: `${LAYOUT.padding}px` }}
		>
			{monthSections.map((section, sectionIdx) => (
				<div key={section.monthNum} class="monthly-section">
					<div
						class="weekly-unified-grid"
						style={{
							gap: `${gap}px`,
							fontSize: `${labelSize}px`,
							gridTemplateColumns: `${LAYOUT.weekLabelWidth}px repeat(7, ${cellSize}px) auto`,
							gridTemplateRows:
								sectionIdx === 0
									? `auto repeat(${section.weeks.length}, ${cellSize}px)`
									: `repeat(${section.weeks.length}, ${cellSize}px)`,
						}}
					>
						{/* Only first section gets day label header row */}
						{sectionIdx === 0 && (
							<>
								<div class="weekly-corner" />
								{usedDayLabelsMon.map((label, i) => (
									<div key={`day-${i}`} class="weekly-day-label">
										{label}
									</div>
								))}
								<div class="weekly-corner" />
							</>
						)}

						{section.weeks.map((week, weekIdx) => (
							<>
								{/* Month number in first row */}
								{weekIdx === 0 ? (
									<div
										key={`mn-${section.monthNum}`}
										class="monthly-section-month-num"
										style={{
											fontSize: monthNumFontSize,
											viewTransitionName:
												getMonthNumberTransitionName(
													section.monthNum,
												),
										}}
									>
										{section.monthNum}
									</div>
								) : (
									<div
										key={`wn-${weekIdx}`}
										class="weekly-week-num"
									/>
								)}
								{week.map((day, dayOfWeek) =>
									day ? (
										<div
											key={`${weekIdx}-${dayOfWeek}`}
											class={`weekly-cell ${day.passed ? "passed" : "future"} ${day.color ? "milestone" : ""} ${day.isUncoloredMilestone || day.color === "subtle" ? "uncolored-milestone" : ""} ${day.isOddWeek ? "odd-week" : "even-week"} ${day.isToday ? "today" : ""} ${selectedDayIndex === day.index ? "selected" : ""} ${highlightedDays.value.indices.has(day.index) ? "highlighted" : ""}`}
											style={{
												...(day.isToday
													? {
															viewTransitionName:
																"today-marker",
														}
													: {}),
												...(day.color &&
												day.color !== "subtle"
													? day.isToday
														? {
																"--day-target-bg": `var(--color-${day.color})`,
															}
														: {
																background: `var(--color-${day.color})`,
															}
													: {}),
												...(highlightedDays.value.indices.has(
													day.index,
												) && highlightedDays.value.color
													? {
															"--highlight-color": `var(--color-${highlightedDays.value.color})`,
														}
													: {}),
											}}
											onClick={(e) =>
												onDayClick(
													e as unknown as MouseEvent,
													day,
												)
											}
										/>
									) : (
										<div
											key={`${weekIdx}-${dayOfWeek}`}
											class="weekly-cell empty"
										/>
									),
								)}
								<div
									key={`month-${weekIdx}`}
									class="weekly-month-label"
								>
									{section.monthLabels.get(weekIdx) || ""}
								</div>
							</>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
