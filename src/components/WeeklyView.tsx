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
			// Portrait monthly: size cells for a single month section (scrollable)
			availableWidth = windowSize.width - padding * 2 - weekLabelWidth * 2;
			availableHeight = windowSize.height - padding * 2 - dayLabelHeight;
			numCols = 7;
			// Use max weeks per month (~5) instead of totalWeeks for larger cells
			const totalMonths30 = Math.ceil(totalDays / MONTH_DAYS);
			let maxWPM = 5;
			for (let m = 0; m < totalMonths30; m++) {
				const firstDay = m * MONTH_DAYS;
				const lastDay = Math.min((m + 1) * MONTH_DAYS - 1, totalDays - 1);
				const firstWeek = Math.floor((startDayOfWeek + firstDay) / 7);
				const lastWeek = Math.floor((startDayOfWeek + lastDay) / 7);
				maxWPM = Math.max(maxWPM, lastWeek - firstWeek + 1);
			}
			numRows = maxWPM;
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

		return {
			cellSize: Math.max(size, 8),
			labelSize: Math.max(8, Math.min(11, size * 0.4)),
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
		type MonthSection = {
			monthNum: number;
			weekIndices: number[];
			monthLabels: Map<number, string>;
		};
		const sections: MonthSection[] = [];
		let currentSection: MonthSection | null = null;

		for (let weekIndex = 0; weekIndex < weekLabels.length; weekIndex++) {
			const label = weekLabels[weekIndex];
			if (label.month30Num) {
				currentSection = {
					monthNum: label.month30Num,
					weekIndices: [weekIndex],
					monthLabels: new Map(),
				};
				sections.push(currentSection);
			} else if (currentSection) {
				currentSection.weekIndices.push(weekIndex);
			}
			if (label.month && currentSection) {
				currentSection.monthLabels.set(weekIndex, label.month);
			}
		}
		return sections;
	}, [weekLabels, mode, isLandscape]);

	const usedDayLabels = cellSize < 20 ? DAY_LABELS_SHORT : DAY_LABELS;

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
		// Portrait monthly: separate sections per month
		return (
			<div
				class="weekly-view portrait monthly-sections"
				style={{ padding: `${LAYOUT.padding}px` }}
			>
				{monthSections.map((section) => (
					<div key={section.monthNum} class="monthly-section">
						<div
							class="weekly-unified-grid"
							style={{
								gap: `${gap}px`,
								fontSize: `${labelSize}px`,
								gridTemplateColumns: `auto repeat(7, ${cellSize}px) auto`,
								gridTemplateRows: `auto repeat(${section.weekIndices.length}, ${cellSize}px)`,
							}}
						>
							<div
								class="monthly-section-month-num"
								style={{
									fontSize: `${Math.max(labelSize * 1.8, 16)}px`,
									viewTransitionName: getMonthNumberTransitionName(
										section.monthNum,
									),
								}}
							>
								{section.monthNum}
							</div>
							{usedDayLabels.map((label, i) => (
								<div key={`day-${i}`} class="weekly-day-label">
									{label}
								</div>
							))}
							<div class="weekly-corner" />

							{section.weekIndices.map((weekIndex) => (
								<>
									<div key={`week-${weekIndex}`} class="weekly-week-num" />
									{weekData[weekIndex].map((day, dayOfWeek) =>
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
									<div
										key={`month-${weekIndex}`}
										class="weekly-month-label"
									>
										{section.monthLabels.get(weekIndex) || ""}
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
