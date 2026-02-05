import { flushSync } from "preact/compat";
import { ShaderBackground } from "./ShaderBackground";

type LandingViewProps = {
	onEnter: () => void;
};

export function LandingView({ onEnter }: LandingViewProps) {
	const handleClick = () => {
		if (navigator.vibrate) {
			navigator.vibrate(10);
		}
		if (document.startViewTransition) {
			document.startViewTransition(() => {
				flushSync(() => {
					onEnter();
				});
			});
		} else {
			onEnter();
		}
	};

	return (
		<div class="landing-view">
			<ShaderBackground />
			<div class="landing-circle">
				<span class="landing-emoji">🐣</span>
				<span class="landing-text">
					Gaby & David
					<br />
					are expecting
				</span>
			</div>
			<button
				class="landing-button"
				style={{ viewTransitionName: "today-marker" }}
				onClick={handleClick}
			>
				See progress
			</button>
		</div>
	);
}
