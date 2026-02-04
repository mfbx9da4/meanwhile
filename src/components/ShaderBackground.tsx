import { useEffect, useRef } from "preact/hooks";

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// A shader that evokes the miracle of life beginning -
// organic forms floating in warm fluid, cells dividing,
// bioluminescent glow, the universe being born
const fragmentShaderSource = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform bool u_darkMode;

  #define PI 3.14159265359
  #define TAU 6.28318530718

  // Smooth noise
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 6; i++) {
      sum += noise(p * freq) * amp;
      freq *= 2.0;
      amp *= 0.5;
    }
    return sum;
  }

  // Smooth metaball distance - organic blob shapes
  float metaball(vec2 p, vec2 center, float radius) {
    float d = length(p - center);
    return radius / (d * d + 0.001);
  }

  // Heartbeat pulse - the rhythm of life
  float heartbeat(float t) {
    float beat = sin(t * TAU) * 0.5 + 0.5;
    beat = pow(beat, 4.0);
    // Double beat like a real heart
    float beat2 = sin((t + 0.15) * TAU) * 0.5 + 0.5;
    beat2 = pow(beat2, 8.0) * 0.5;
    return beat + beat2;
  }

  // Cellular division pattern
  vec2 cellDivide(vec2 p, float t) {
    float split = sin(t * 0.5) * 0.5 + 0.5;
    split = smoothstep(0.3, 0.7, split);
    vec2 offset = vec2(split * 0.15, 0.0);
    float d1 = length(p - offset);
    float d2 = length(p + offset);
    return vec2(d1, d2);
  }

  // Flowing tendrils - like umbilical connections
  float tendril(vec2 p, float t) {
    float angle = atan(p.y, p.x);
    float radius = length(p);
    float wave = sin(angle * 3.0 + t * 2.0 + radius * 8.0) * 0.5 + 0.5;
    wave *= exp(-radius * 2.0);
    return wave;
  }

  // Particle field - floating cells, stars being born
  float particles(vec2 p, float t) {
    float sum = 0.0;
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      vec2 pos = vec2(
        sin(fi * 1.7 + t * 0.3) * 0.4 + sin(fi * 0.3 + t * 0.1) * 0.2,
        cos(fi * 2.3 + t * 0.2) * 0.4 + cos(fi * 0.7 + t * 0.15) * 0.2
      );
      float size = 0.015 + sin(fi * 3.7 + t) * 0.008;
      float d = length(p - pos);
      float glow = size / (d + 0.01);
      glow = pow(glow, 1.5);
      sum += glow * 0.15;
    }
    return sum;
  }

  // Nebula clouds - cosmic birth
  float nebula(vec2 p, float t) {
    vec2 q = p;
    q += vec2(
      fbm(p * 2.0 + t * 0.1),
      fbm(p * 2.0 + vec2(5.2, 1.3) + t * 0.12)
    ) * 0.3;
    return fbm(q * 3.0);
  }

  // Aurora ribbons - ethereal light
  float aurora(vec2 p, float t) {
    float sum = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float y = sin(p.x * (3.0 + fi) + t * (0.5 + fi * 0.1) + fi * 2.0) * 0.15;
      y += sin(p.x * (7.0 + fi * 2.0) + t * 0.3) * 0.05;
      float ribbon = smoothstep(0.08, 0.0, abs(p.y - y - fi * 0.15 + 0.2));
      ribbon *= 0.5 + 0.5 * sin(p.x * 20.0 + t * 2.0 + fi);
      sum += ribbon * (0.4 - fi * 0.08);
    }
    return sum;
  }

  // Membrane texture - organic surface
  float membrane(vec2 p, float t) {
    float n = fbm(p * 8.0 + t * 0.2);
    float n2 = fbm(p * 16.0 - t * 0.15);
    return n * 0.6 + n2 * 0.4;
  }

  // Main composition
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    // Centered coordinates
    vec2 p = (uv - 0.5);
    p.x *= aspect;

    float t = u_time * 0.4;

    // === LAYER 1: Deep background nebula ===
    float neb = nebula(p * 1.5, t * 0.5);

    // === LAYER 2: Central organic mass - the origin of life ===
    float metaSum = 0.0;

    // Main pulsing core
    float pulse = heartbeat(t * 0.7) * 0.3 + 0.7;
    metaSum += metaball(p, vec2(0.0), 0.08 * pulse);

    // Orbiting cells - like the first division of life
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float angle = fi * TAU / 5.0 + t * 0.3;
      float radius = 0.15 + sin(t * 0.5 + fi) * 0.05;
      vec2 pos = vec2(cos(angle), sin(angle)) * radius;
      float size = 0.025 + sin(t + fi * 2.0) * 0.01;
      metaSum += metaball(p, pos, size);
    }

    // Smaller satellite particles
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float angle = fi * TAU / 8.0 - t * 0.2;
      float radius = 0.28 + cos(t * 0.3 + fi * 1.5) * 0.08;
      vec2 pos = vec2(cos(angle), sin(angle)) * radius;
      metaSum += metaball(p, pos, 0.012);
    }

    // Convert metaball field to smooth organic shape
    float organicShape = smoothstep(1.0, 3.0, metaSum);
    float organicGlow = smoothstep(0.5, 2.5, metaSum) * 0.5;

    // === LAYER 3: Flowing tendrils connecting everything ===
    float tend = tendril(p, t);

    // === LAYER 4: Floating particles - cellular matter / stardust ===
    float parts = particles(p, t);

    // === LAYER 5: Aurora / ethereal light waves ===
    float aur = aurora(p, t);

    // === LAYER 6: Subtle membrane texture ===
    float memb = membrane(p, t) * 0.15;

    // === COLOR COMPOSITION ===
    vec3 col;

    if (u_darkMode) {
      // Dark mode: Deep forest womb - dark with bioluminescent green glow
      vec3 bgDeep = vec3(0.01, 0.03, 0.02);      // Near black with green hint
      vec3 bgNebula = vec3(0.03, 0.08, 0.05);    // Deep green nebula
      vec3 warmGlow = vec3(0.2, 0.6, 0.4);       // Forest green life glow
      vec3 lifeCore = vec3(0.5, 0.9, 0.6);       // Bright mint core
      vec3 auroraCol = vec3(0.3, 0.8, 0.5);      // Green aurora
      vec3 particleCol = vec3(0.8, 1.0, 0.85);   // Pale green particles

      // Build up the scene
      col = mix(bgDeep, bgNebula, neb);
      col += warmGlow * organicGlow * 0.8;
      col = mix(col, lifeCore, organicShape * 0.7);
      col += auroraCol * aur * 0.4;
      col += particleCol * parts;
      col += warmGlow * tend * 0.3;
      col += vec3(0.05, 0.1, 0.06) * memb;

      // Vignette - darkness at edges
      float vig = 1.0 - length(p) * 0.7;
      vig = smoothstep(0.0, 1.0, vig);
      col *= vig * 0.9 + 0.1;

    } else {
      // Light mode: Fresh spring growth - soft and verdant
      vec3 bgWarm = vec3(0.95, 0.98, 0.95);      // Soft cream with green tint
      vec3 bgGreen = vec3(0.90, 0.95, 0.90);     // Pale sage
      vec3 leafTone = vec3(0.80, 0.92, 0.82);    // Soft leaf green
      vec3 lifeGlow = vec3(0.55, 0.80, 0.60);    // Fresh green glow
      vec3 highlight = vec3(0.96, 1.0, 0.96);    // Bright highlight
      vec3 auroraCol = vec3(0.85, 0.95, 0.88);   // Soft green accent

      // Build up the scene
      col = mix(bgWarm, bgGreen, neb * 0.5);
      col = mix(col, leafTone, organicGlow * 0.6);
      col = mix(col, lifeGlow, organicShape * 0.5);
      col = mix(col, highlight, organicShape * pulse * 0.3);
      col = mix(col, auroraCol, aur * 0.2);
      col += vec3(0.9, 1.0, 0.9) * parts * 0.5;
      col = mix(col, leafTone, tend * 0.2);
      col -= vec3(0.03, 0.02, 0.03) * memb;

      // Soft radial warmth from center
      float centerWarm = 1.0 - length(p) * 0.8;
      centerWarm = smoothstep(0.0, 1.0, centerWarm);
      col = mix(col, lifeGlow * 1.1, centerWarm * 0.15);
    }

    // === FINAL TOUCHES ===

    // Subtle chromatic shimmer
    float shimmer = sin(uv.x * 50.0 + uv.y * 30.0 + t * 4.0);
    shimmer = shimmer * 0.01 + 1.0;
    col *= shimmer;

    // Gentle breathing - the whole scene pulses subtly
    float breath = sin(t * 0.8) * 0.02 + 1.0;
    col *= breath;

    // Ensure we don't clip
    col = clamp(col, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function createShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string
): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error("Shader compile error:", gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function createProgram(
	gl: WebGLRenderingContext,
	vertexShader: WebGLShader,
	fragmentShader: WebGLShader
): WebGLProgram | null {
	const program = gl.createProgram();
	if (!program) return null;
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("Program link error:", gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
		return null;
	}
	return program;
}

export function ShaderBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const frameRef = useRef<number>(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext("webgl", {
			alpha: false,
			antialias: true,
			preserveDrawingBuffer: false,
		});
		if (!gl) {
			console.warn("WebGL not supported");
			return;
		}

		const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = createShader(
			gl,
			gl.FRAGMENT_SHADER,
			fragmentShaderSource
		);
		if (!vertexShader || !fragmentShader) return;

		const program = createProgram(gl, vertexShader, fragmentShader);
		if (!program) return;

		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW
		);

		const positionLocation = gl.getAttribLocation(program, "a_position");
		const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
		const timeLocation = gl.getUniformLocation(program, "u_time");
		const darkModeLocation = gl.getUniformLocation(program, "u_darkMode");

		const resize = () => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = canvas.clientWidth * dpr;
			canvas.height = canvas.clientHeight * dpr;
			gl.viewport(0, 0, canvas.width, canvas.height);
		};

		resize();
		window.addEventListener("resize", resize);

		const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
		let isDarkMode = darkModeQuery.matches;
		const handleColorSchemeChange = (e: MediaQueryListEvent) => {
			isDarkMode = e.matches;
		};
		darkModeQuery.addEventListener("change", handleColorSchemeChange);

		const startTime = performance.now();
		const render = () => {
			const time = (performance.now() - startTime) / 1000;

			gl.useProgram(program);

			gl.enableVertexAttribArray(positionLocation);
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

			gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
			gl.uniform1f(timeLocation, time);
			gl.uniform1i(darkModeLocation, isDarkMode ? 1 : 0);

			gl.drawArrays(gl.TRIANGLES, 0, 6);

			frameRef.current = requestAnimationFrame(render);
		};

		frameRef.current = requestAnimationFrame(render);

		return () => {
			cancelAnimationFrame(frameRef.current);
			window.removeEventListener("resize", resize);
			darkModeQuery.removeEventListener("change", handleColorSchemeChange);
			gl.deleteProgram(program);
			gl.deleteShader(vertexShader);
			gl.deleteShader(fragmentShader);
			gl.deleteBuffer(positionBuffer);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			class="shader-background"
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				zIndex: 0,
			}}
		/>
	);
}
