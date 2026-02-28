import {
	useEffect,
	useRef,
	useCallback,
	useState,
	useMemo,
} from "preact/hooks";
import { haptic } from "ios-haptics";

// Grid positions for 3x3 grid
const GRID_POSITIONS = [
	{ x: 1, y: 1 },
	{ x: 7, y: 1 },
	{ x: 13, y: 1 },
	{ x: 1, y: 7 },
	{ x: 7, y: 7 },
	{ x: 13, y: 7 },
	{ x: 1, y: 13 },
	{ x: 7, y: 13 },
	{ x: 13, y: 13 },
];

// Seeded shuffle for consistent results
function seededShuffle<T>(array: T[], seed: number): T[] {
	const result = [...array];
	let m = result.length;
	let s = seed;
	while (m) {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		const i = s % m--;
		[result[m], result[i]] = [result[i], result[m]];
	}
	return result;
}

declare const __GIT_COMMIT__: string;
declare const __GIT_DATE__: string;
declare const __GIT_MESSAGE__: string;

const VERSION_TAP_COUNT = 3;
const VERSION_TAP_TIMEOUT = 500;

export function useVersionTap(onShowVersion: () => void) {
	const versionTapCount = useRef(0);
	const versionTapTimer = useRef<number | null>(null);

	const handleVersionTap = useCallback(() => {
		if (versionTapTimer.current) {
			clearTimeout(versionTapTimer.current);
		}
		versionTapCount.current++;
		if (versionTapCount.current >= VERSION_TAP_COUNT) {
			versionTapCount.current = 0;
			haptic();
			onShowVersion();
		} else {
			versionTapTimer.current = window.setTimeout(() => {
				versionTapCount.current = 0;
			}, VERSION_TAP_TIMEOUT);
		}
	}, [onShowVersion]);

	return handleVersionTap;
}

function ShuffleGridIcon({ shuffleKey }: { shuffleKey: number }) {
	const positions = useMemo(() => {
		if (shuffleKey === 0) return GRID_POSITIONS;
		return seededShuffle(GRID_POSITIONS, shuffleKey);
	}, [shuffleKey]);

	return (
		<svg width="14" height="14" viewBox="0 0 18 18" fill="none">
			{GRID_POSITIONS.map((originalPos, i) => {
				const targetPos = positions[i];
				const dx = targetPos.x - originalPos.x;
				const dy = targetPos.y - originalPos.y;
				return (
					<rect
						key={i}
						x={originalPos.x}
						y={originalPos.y}
						width="4"
						height="4"
						rx="1"
						fill="currentColor"
						style={{
							transform: `translate(${dx}px, ${dy}px)`,
							transition: "transform 0.3s ease",
						}}
					/>
				);
			})}
		</svg>
	);
}

function EditIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
			<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
		</svg>
	);
}

import type { ViewMode } from "../hooks/useViewMode";

type InfoBarProps = {
	totalDays: number;
	daysPassed: number;
	viewMode: ViewMode;
	onToggleView: () => void;
	onOpenConfigEditor?: () => void;
};

const MONTH_DAYS = 31;

export function InfoBar({ totalDays, daysPassed, viewMode, onToggleView, onOpenConfigEditor }: InfoBarProps) {
	const [showVersion, setShowVersion] = useState(false);
	const [editUnlocked, setEditUnlocked] = useState(false);
	const [shuffleKey, setShuffleKey] = useState(0);
	const handleVersionTap = useVersionTap(() => {
		setShowVersion(true);
		setEditUnlocked(true);
	});

	const handleOpenEditor = useCallback(() => {
		haptic();
		onOpenConfigEditor?.();
	}, [onOpenConfigEditor]);

	const handleToggle = useCallback(() => {
		setShuffleKey((k) => k + 1);
		haptic();
		if (document.startViewTransition) {
			document.startViewTransition(() => onToggleView());
		} else {
			onToggleView();
		}
	}, [onToggleView]);

	const daysRemaining = totalDays - daysPassed;
	const daysElapsed = Math.max(0, daysPassed - 1);
	const progressPercent = ((daysPassed / totalDays) * 100).toFixed(1);
	const isMonthly = viewMode === "monthly";

	// Weekly calculations
	const currentWeek = Math.floor(daysElapsed / 7) + 1;
	const currentDayInWeek = daysElapsed % 7;
	const weeksRemaining = Math.floor(daysRemaining / 7);
	const extraDaysWeek = daysRemaining % 7;

	// Monthly calculations (completed months + days into current)
	const currentMonth = Math.floor(daysElapsed / MONTH_DAYS);
	const currentDayInMonth = daysElapsed % MONTH_DAYS;
	const monthsRemaining = Math.floor(daysRemaining / MONTH_DAYS);
	const extraDaysMonth = daysRemaining % MONTH_DAYS;

	const timeRemaining = isMonthly
		? monthsRemaining > 0
			? `Due in ${monthsRemaining} month${monthsRemaining !== 1 ? "s" : ""}${extraDaysMonth > 0 ? ` and ${extraDaysMonth} day${extraDaysMonth !== 1 ? "s" : ""}` : ""}`
			: `Due in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`
		: weeksRemaining > 0
			? `Due in ${weeksRemaining} week${weeksRemaining !== 1 ? "s" : ""}${extraDaysWeek > 0 ? ` and ${extraDaysWeek} day${extraDaysWeek !== 1 ? "s" : ""}` : ""}`
			: `Due in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`;
	const timeRemainingCompact = isMonthly
		? monthsRemaining > 0
			? `Due in ${monthsRemaining}mo${extraDaysMonth > 0 ? ` ${extraDaysMonth}d` : ""}`
			: `Due in ${daysRemaining}d`
		: weeksRemaining > 0
			? `Due in ${weeksRemaining}w${extraDaysWeek > 0 ? ` ${extraDaysWeek}d` : ""}`
			: `Due in ${daysRemaining}d`;

	return (
		<div class="info">
			<button
				class="view-toggle"
				onClick={handleToggle}
				aria-label="Toggle view"
			>
				<ShuffleGridIcon shuffleKey={shuffleKey} />
			</button>
			<span class="info-text">
				<span class="info-full">
					{isMonthly ? "Month" : "Week"} {isMonthly ? currentMonth : currentWeek}
					{(isMonthly ? currentDayInMonth : currentDayInWeek) > 0
						? ` + ${isMonthly ? currentDayInMonth : currentDayInWeek}`
						: ""}
				</span>
				<span class="info-compact">
					{isMonthly ? "Mo" : "Wk"} {isMonthly ? currentMonth : currentWeek}
					{(isMonthly ? currentDayInMonth : currentDayInWeek) > 0
						? ` + ${isMonthly ? currentDayInMonth : currentDayInWeek}`
						: ""}
				</span>
			</span>
			<span class="info-text" onClick={handleVersionTap}>
				{progressPercent}%
			</span>
			<span class="info-text">
				<span class="info-full">{timeRemaining}</span>
				<span class="info-compact">{timeRemainingCompact}</span>
			</span>
			{onOpenConfigEditor && editUnlocked && (
				<button
					class="view-toggle"
					onClick={handleOpenEditor}
					aria-label="Edit config"
				>
					<EditIcon />
				</button>
			)}
			{showVersion && <VersionPopover onClose={() => setShowVersion(false)} />}
		</div>
	);
}

function getTimeAgo(dateString: string): string {
	const isoString = dateString.replace(" ", "T").replace(" ", "");
	const date = new Date(isoString);

	if (isNaN(date.getTime())) {
		return "";
	}

	const now = new Date();
	const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (seconds < 0) {
		return "";
	}
	if (seconds < 60) {
		return seconds === 1 ? "1 second ago" : `${seconds} seconds ago`;
	}
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
	}
	const days = Math.floor(hours / 24);
	if (days < 30) {
		return days === 1 ? "1 day ago" : `${days} days ago`;
	}
	const months = Math.floor(days / 30);
	if (months < 12) {
		return months === 1 ? "1 month ago" : `${months} months ago`;
	}
	const years = Math.floor(months / 12);
	return years === 1 ? "1 year ago" : `${years} years ago`;
}

export function VersionPopover({ onClose }: { onClose: () => void }) {
	useEffect(() => {
		const timer = setTimeout(onClose, 5000);
		return () => clearTimeout(timer);
	}, [onClose]);

	const timeAgo = getTimeAgo(__GIT_DATE__);

	return (
		<div class="version-popover" onClick={onClose}>
			<div class="version-content">
				<div class="version-row">
					<span class="version-label">Commit</span>
					<span class="version-value">{__GIT_COMMIT__}</span>
				</div>
				<div class="version-row">
					<span class="version-label">Date</span>
					<span class="version-value">
						{__GIT_DATE__}
						<br />
						{timeAgo && ` (${timeAgo})`}
					</span>
				</div>
				<div class="version-row">
					<span class="version-label">Message</span>
					<span class="version-value">{__GIT_MESSAGE__}</span>
				</div>
			</div>
		</div>
	);
}
