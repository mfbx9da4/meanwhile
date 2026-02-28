import { useMemo } from "preact/hooks";
import type { DayInfo } from "../types";
import { LAYOUT } from "../constants";
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_LABELS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS_MON_SHORT = ["M", "T", "W", "T", "F", "S", "S"];

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

const MONTH_DAYS = 30;

type WeeklyViewProps = {
	days: DayInfo[];
	windowSize: { width: number; height: number };
	isLandscape: boolean;
	startDate: Date;
	onDayClick: (e: MouseEvent, day: DayInfo) => void;
	selectedDayIndex: number | null;
	mode?: "weekly" | "monthly";
};

export function WeeklyView({
	days,
	windowSize,
	isLandscape,
	startDate,
	onDayClick,
	selectedDayIndex,
	mode = "weekly",
}: WeeklyViewProps) {
	const startDayOfWeek = startDate.getDay();
	const totalDays = days.length;
	const totalWeeks = Math.ceil((startDayOfWeek + totalDays) / 7);

	const weekLabels = useMemo(() => {
		const monthStartsInWeek: Map<number, string> = new Map();
		const month30StartsInWeek: Map<number, number> = new Map();
		let lastMonth = -1;
		let lastMonth30 = -1;

		for (let i = 0; i < totalDays; i++) {
			const date = addDays(startDate, i);
			const month = date.getMonth();
			if (month !== lastMonth) {
				const weekIndex = Math.floor((startDayOfWeek + i) / 7);
				if (!monthStartsInWeek.has(weekIndex)) {
					monthStartsInWeek.set(weekIndex, MONTHS[month]);
				}
				lastMonth = month;
			}

			const month30Num = Math.floor(i / MONTH_DAYS) + 1;
			if (month30Num !== lastMonth30) {
				const weekIndex = Math.floor((startDayOfWeek + i) / 7);
				if (!month30StartsInWeek.has(weekIndex)) {
					month30StartsInWeek.set(weekIndex, month30Num);
				}
				lastMonth30 = month30Num;
			}
		}

		const labels: {
			weekNum: number;
			month?: string;
			month30Num?: number;
			position: number;
		}[] = [];
		for (let week = 0; week < totalWeeks; week++) {
			labels.push({
				weekNum: week + 1,
				month: monthStartsInWeek.get(week),
				month30Num: month30StartsInWeek.get(week),
				position: week,
			});
		}
		return labels;
	}, [totalDays, startDayOfWeek, totalWeeks, startDate]);

	const { cellSize, labelSize, gap } = useMemo(() => {
		const {
			padding,
			weeklyGridGap,
			weekLabelWidth,
			monthLabelHeight,
			dayLabelHeight,
		} = LAYOUT;

		let availableWidth: number;
		let availableHeight: number;
		let numCols: number;
		let numRows: number;

		if (isLandscape) {
			availableWidth = windowSize.width - padding * 2 - weekLabelWidth;
			availableHeight = windowSize.height - padding * 2 - monthLabelHeight;
			numCols = totalWeeks;
			numRows = 7;
		} else if (mode === "monthly") {
			// Portrait monthly: all sections must fit on screen (no scroll)
			// Each month grid starts on Monday: (getDay() + 6) % 7
			availableWidth = windowSize.width - padding * 2 - weekLabelWidth * 2;
			numCols = 7;
			const numMonths = Math.ceil(totalDays / MONTH_DAYS);
			const sectionGap = 8; // matches CSS .monthly-sections gap
			// Count total week rows across all per-month grids
			let totalMonthWeeks = 0;
			for (let m = 0; m < numMonths; m++) {
				const monthStartDay = m * MONTH_DAYS;
				const monthEndDay = Math.min(
					(m + 1) * MONTH_DAYS - 1,
					totalDays - 1,
				);
				const monthDayCount = monthEndDay - monthStartDay + 1;
				const monthStartDow =
					(addDays(startDate, monthStartDay).getDay() + 6) % 7;
				totalMonthWeeks += Math.ceil(
					(monthStartDow + monthDayCount) / 7,
				);
			}
			// Only first section has day-label header row
			const headerHeight = 16;
			availableHeight =
				windowSize.height -
				padding * 2 -
				headerHeight -
				sectionGap * (numMonths - 1) -
				weeklyGridGap; // header-to-cell gap in first section
			numRows = totalMonthWeeks;
		} else {
			// Portrait weekly
			availableWidth = windowSize.width - padding * 2 - weekLabelWidth * 2;
			availableHeight = windowSize.height - padding * 2 - dayLabelHeight;
			numCols = 7;
			numRows = totalWeeks;
		}

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
	}, [windowSize, isLandscape, totalWeeks, mode, totalDays, startDayOfWeek]);

	const weekData = useMemo(() => {
		const weeks: (DayInfo | null)[][] = [];

		for (let week = 0; week < totalWeeks; week++) {
			const weekDays: (DayInfo | null)[] = [];
			for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
				const dayIndex = week * 7 + dayOfWeek - startDayOfWeek;
				if (dayIndex >= 0 && dayIndex < totalDays) {
					weekDays.push(days[dayIndex]);
				} else {
					weekDays.push(null);
				}
			}
			weeks.push(weekDays);
		}
		return weeks;
	}, [days, totalWeeks, startDayOfWeek, totalDays]);

	const monthSections = useMemo(() => {
		if (mode !== "monthly" || isLandscape) return [];
		const numMonths = Math.ceil(totalDays / MONTH_DAYS);
		const sections: {
			monthNum: number;
			weeks: (DayInfo | null)[][];
			monthLabels: Map<number, string>;
		}[] = [];

		for (let m = 0; m < numMonths; m++) {
			const monthStartDay = m * MONTH_DAYS;
			const monthEndDay = Math.min((m + 1) * MONTH_DAYS - 1, totalDays - 1);
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
					if (dayInMonth >= 0 && dayInMonth < monthDayCount && dayIndex < totalDays) {
						weekDays.push(days[dayIndex]);
					} else {
						weekDays.push(null);
					}
				}
				weeks.push(weekDays);
			}

			// Calendar month labels: only on the row containing the 1st of each month
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

			sections.push({ monthNum: m + 1, weeks, monthLabels });
		}
		return sections;
	}, [days, totalDays, startDate, mode, isLandscape]);

	const usedDayLabels = cellSize < 20 ? DAY_LABELS_SHORT : DAY_LABELS;
	const usedDayLabelsMon = cellSize < 20 ? DAY_LABELS_MON_SHORT : DAY_LABELS_MON;

	const getWeekNumberTransitionName = (weekNum: number) =>
		`week-number-${weekNum}`;
	const getMonthNumberTransitionName = (monthNum: number) =>
		`month-number-${monthNum}`;

	if (isLandscape) {
		const gridWidth = totalWeeks * cellSize + (totalWeeks - 1) * gap;

		return (
			<div
				class="weekly-view landscape"
				style={{
					padding: `${LAYOUT.padding}px`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: "100%",
				}}
			>
				<div class="weekly-body">
					<div
						class="weekly-day-labels"
						style={{ gap: `${gap}px`, marginTop: `${labelSize + 4}px` }}
					>
						{usedDayLabels.map((label, i) => (
							<span
								key={i}
								class="weekly-day-label"
								style={{ height: `${cellSize}px`, fontSize: `${labelSize}px` }}
							>
								{label}
							</span>
						))}
					</div>

					<div class="weekly-grid-wrapper">
						<div
							class="weekly-week-nums-row"
							style={{ height: `${labelSize + 4}px`, width: `${gridWidth}px` }}
						>
							{mode === "monthly"
								? weekLabels
										.filter((l) => l.month30Num)
										.map((label, i) => (
											<span
												key={i}
												class="weekly-week-num"
												style={{
													viewTransitionName: getMonthNumberTransitionName(
														label.month30Num!,
													),
													left: `${label.position * (cellSize + gap) + cellSize / 2}px`,
													fontSize: `${labelSize}px`,
												}}
											>
												{label.month30Num}
											</span>
										))
								: weekLabels.map((label, i) => (
										<span
											key={i}
											class="weekly-week-num"
											style={{
												viewTransitionName: getWeekNumberTransitionName(
													label.weekNum,
												),
												left: `${label.position * (cellSize + gap) + cellSize / 2}px`,
												fontSize: `${labelSize}px`,
											}}
										>
											{label.weekNum}
										</span>
									))}
						</div>

						<div
							class="weekly-grid"
							style={{
								gridTemplateColumns: `repeat(${totalWeeks}, ${cellSize}px)`,
								gridTemplateRows: `repeat(7, ${cellSize}px)`,
								gap: `${gap}px`,
							}}
						>
							{Array.from({ length: 7 }, (_, dayOfWeek) =>
								weekData.map((week, weekIndex) => {
									const day = week[dayOfWeek];
									return day ? (
										<div
											key={`${weekIndex}-${dayOfWeek}`}
											class={`weekly-cell ${day.passed ? "passed" : "future"} ${day.color ? "milestone" : ""} ${day.isUncoloredMilestone || day.color === "subtle" ? "uncolored-milestone" : ""} ${day.isOddWeek ? "odd-week" : "even-week"} ${day.isToday ? "today" : ""} ${selectedDayIndex === day.index ? "selected" : ""} ${highlightedDays.value.indices.has(day.index) ? "highlighted" : ""}`}
											style={{
												...(day.isToday
													? { viewTransitionName: "today-marker" }
													: {}),
												gridColumn: weekIndex + 1,
												gridRow: dayOfWeek + 1,
												...(day.color && day.color !== "subtle"
													? day.isToday
														? { "--day-target-bg": `var(--color-${day.color})` }
														: { background: `var(--color-${day.color})` }
													: {}),
												...(highlightedDays.value.indices.has(day.index) &&
												highlightedDays.value.color
													? {
															"--highlight-color": `var(--color-${highlightedDays.value.color})`,
														}
													: {}),
											}}
											onClick={(e) =>
												onDayClick(e as unknown as MouseEvent, day)
											}
										/>
									) : (
										<div
											key={`${weekIndex}-${dayOfWeek}`}
											class="weekly-cell empty"
											style={{
												gridColumn: weekIndex + 1,
												gridRow: dayOfWeek + 1,
											}}
										/>
									);
								}),
							)}
						</div>

						<div
							class="weekly-month-labels-row"
							style={{ height: `${labelSize + 4}px`, width: `${gridWidth}px` }}
						>
							{weekLabels
								.filter((l) => l.month)
								.map((label, i) => (
									<span
										key={i}
										class="weekly-month-label"
										style={{
											left: `${label.position * (cellSize + gap) + cellSize / 2}px`,
											fontSize: `${labelSize}px`,
										}}
									>
										{label.month}
									</span>
								))}
						</div>
					</div>
				</div>
			</div>
		);
	} else if (mode === "monthly") {
		// Portrait monthly: separate sections per month, each with its own grid
		// Only first section has day-of-week header; all grids start on Monday
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
									{/* Month number in last row (aligned with end of month) */}
									{weekIdx === section.weeks.length - 1 ? (
										<div
											key={`mn-${section.monthNum}`}
											class="monthly-section-month-num"
											style={{
												fontSize: monthNumFontSize,
												viewTransitionName:
													getMonthNumberTransitionName(section.monthNum),
											}}
										>
											{section.monthNum}
										</div>
									) : (
										<div key={`wn-${weekIdx}`} class="weekly-week-num" />
									)}
									{week.map((day, dayOfWeek) =>
										day ? (
											<div
												key={`${weekIdx}-${dayOfWeek}`}
												class={`weekly-cell ${day.passed ? "passed" : "future"} ${day.color ? "milestone" : ""} ${day.isUncoloredMilestone || day.color === "subtle" ? "uncolored-milestone" : ""} ${day.isOddWeek ? "odd-week" : "even-week"} ${day.isToday ? "today" : ""} ${selectedDayIndex === day.index ? "selected" : ""} ${highlightedDays.value.indices.has(day.index) ? "highlighted" : ""}`}
												style={{
													...(day.isToday
														? { viewTransitionName: "today-marker" }
														: {}),
													...(day.color && day.color !== "subtle"
														? day.isToday
															? {
																	"--day-target-bg": `var(--color-${day.color})`,
																}
															: { background: `var(--color-${day.color})` }
														: {}),
													...(highlightedDays.value.indices.has(day.index) &&
													highlightedDays.value.color
														? {
																"--highlight-color": `var(--color-${highlightedDays.value.color})`,
															}
														: {}),
												}}
												onClick={(e) =>
													onDayClick(e as unknown as MouseEvent, day)
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
	} else {
		// Portrait weekly
		const monthByWeek = new Map(
			weekLabels.filter((l) => l.month).map((l) => [l.position, l.month]),
		);

		return (
			<div
				class="weekly-view portrait"
				style={{ padding: `${LAYOUT.padding}px` }}
			>
				<div
					class="weekly-unified-grid"
					style={{
						gap: `${gap}px`,
						fontSize: `${labelSize}px`,
						gridTemplateColumns: `auto repeat(7, ${cellSize}px) auto`,
						gridTemplateRows: `auto repeat(${totalWeeks}, ${cellSize}px)`,
					}}
				>
					<div class="weekly-corner" />
					{usedDayLabels.map((label, i) => (
						<div key={`day-${i}`} class="weekly-day-label">
							{label}
						</div>
					))}
					<div class="weekly-corner" />

					{weekData.map((week, weekIndex) => (
						<>
							<div
								key={`week-${weekIndex}`}
								class="weekly-week-num"
								style={{
									viewTransitionName: getWeekNumberTransitionName(
										weekIndex + 1,
									),
								}}
							>
								{weekIndex + 1}
							</div>
							{week.map((day, dayOfWeek) =>
								day ? (
									<div
										key={`${weekIndex}-${dayOfWeek}`}
										class={`weekly-cell ${day.passed ? "passed" : "future"} ${day.color ? "milestone" : ""} ${day.isUncoloredMilestone || day.color === "subtle" ? "uncolored-milestone" : ""} ${day.isOddWeek ? "odd-week" : "even-week"} ${day.isToday ? "today" : ""} ${selectedDayIndex === day.index ? "selected" : ""} ${highlightedDays.value.indices.has(day.index) ? "highlighted" : ""}`}
										style={{
											...(day.isToday
												? { viewTransitionName: "today-marker" }
												: {}),
											...(day.color && day.color !== "subtle"
												? day.isToday
													? {
															"--day-target-bg": `var(--color-${day.color})`,
														}
													: { background: `var(--color-${day.color})` }
												: {}),
											...(highlightedDays.value.indices.has(day.index) &&
											highlightedDays.value.color
												? {
														"--highlight-color": `var(--color-${highlightedDays.value.color})`,
													}
												: {}),
										}}
										onClick={(e) =>
											onDayClick(e as unknown as MouseEvent, day)
										}
									/>
								) : (
									<div
										key={`${weekIndex}-${dayOfWeek}`}
										class="weekly-cell empty"
									/>
								),
							)}
							<div key={`month-${weekIndex}`} class="weekly-month-label">
								{monthByWeek.get(weekIndex) || ""}
							</div>
						</>
					))}
				</div>
			</div>
		);
	}
}
