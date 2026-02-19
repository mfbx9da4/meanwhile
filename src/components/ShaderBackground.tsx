import { useEffect, useRef } from "preact/hooks";

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// A generative shader for landing-page algorithmic art.
// The composition mixes domain-warped flow fields, orbiting rings,
// and interference halos to feel alive rather than static.
const fragmentShaderSource = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform bool u_darkMode;

  #define PI 3.14159265359
  #define TAU 6.28318530718

  // Hash + value noise
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

  vec2 rotate(vec2 p, float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c) * p;
  }

  // Domain warp creates fluid-like trajectories.
  vec2 domainWarp(vec2 p, float t) {
    vec2 q = vec2(
      fbm(p * 1.5 + vec2(0.0, t * 0.12)),
      fbm(p * 1.7 + vec2(4.2, -t * 0.1))
    );
    vec2 r = vec2(
      fbm(p * 2.7 + q + vec2(1.7, 9.2) + t * 0.08),
      fbm(p * 2.4 + q + vec2(8.3, 2.8) - t * 0.06)
    );
    return p + (q - 0.5) * 0.55 + (r - 0.5) * 0.28;
  }

  // Orbiting halos + ripples add structured geometry.
  float orbitField(vec2 p, float t) {
    float sum = 0.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float a = fi * TAU / 7.0 + t * (0.1 + fi * 0.01);
      float radius = 0.12 + 0.045 * sin(t * 0.35 + fi * 1.3);
      vec2 center = vec2(cos(a), sin(a)) * radius * (1.8 + fi * 0.18);
      float d = length(p - center);
      float ring = smoothstep(0.1, 0.0, abs(d - 0.06 - 0.02 * sin(t + fi)));
      sum += ring * (0.6 + 0.4 * sin(fi * 3.1 + t));
    }
    return sum;
  }

  // Polar interference lines feel hand-drawn and algorithmic.
  float contourField(vec2 p, float t) {
    float r = length(p);
    float a = atan(p.y, p.x);
    float spiral = sin(15.0 * r - 4.0 * a + t * 1.2);
    float radial = sin(20.0 * r + t * 0.6);
    float rays = sin(a * 11.0 - t * 0.8 + radial * 0.9);
    return spiral * 0.45 + radial * 0.35 + rays * 0.2;
  }

  float particles(vec2 p, float t) {
    float sparkle = 0.0;
    for (int i = 0; i < 18; i++) {
      float fi = float(i);
      vec2 pos = vec2(
        sin(fi * 2.1 + t * 0.27) * 0.7 + sin(fi * 0.4 - t * 0.09) * 0.18,
        cos(fi * 1.3 + t * 0.31) * 0.5 + cos(fi * 0.8 + t * 0.12) * 0.21
      );
      float size = 0.006 + 0.01 * (sin(fi * 6.7 + t * 1.6) * 0.5 + 0.5);
      float d = length(p - pos);
      sparkle += smoothstep(size, 0.0, d) * (0.3 + 0.7 * hash(vec2(fi, 3.1)));
    }
    return sparkle;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    vec2 p = uv - 0.5;
    p.x *= aspect;
    p *= 1.45;

    float t = u_time;
    vec2 warped = domainWarp(p, t);
    vec2 warped2 = domainWarp(rotate(p, 0.7), t * 0.75);

    float flow = fbm(warped * 2.2 + vec2(t * 0.05, -t * 0.04));
    float flow2 = fbm(warped2 * 3.4 - vec2(t * 0.07, t * 0.03));
    float orbits = orbitField(warped * 0.9, t * 0.8);
    float contours = contourField(warped2, t);
    float grain = hash(gl_FragCoord.xy + t * 37.0);
    float spark = particles(warped, t * 0.9);

    float halo = exp(-2.8 * length(p));
    float field = flow * 0.55 + flow2 * 0.45 + orbits * 0.2 + contours * 0.1;

    vec3 col;

    if (u_darkMode) {
      vec3 bg0 = vec3(0.015, 0.02, 0.03);
      vec3 bg1 = vec3(0.02, 0.08, 0.08);
      vec3 toneA = vec3(0.18, 0.42, 0.38);
      vec3 toneB = vec3(0.24, 0.2, 0.45);
      vec3 toneC = vec3(0.65, 0.85, 0.82);

      col = mix(bg0, bg1, smoothstep(0.1, 0.9, flow));
      col = mix(col, toneA, smoothstep(0.25, 0.9, field) * 0.6);
      col += toneB * max(contours, 0.0) * 0.2;
      col += toneC * (orbits * 0.15 + spark * 0.2);
      col += vec3(0.2, 0.55, 0.45) * halo * 0.25;
      col *= 0.7 + halo * 0.45;

    } else {
      vec3 bg0 = vec3(0.89, 0.94, 0.93);
      vec3 bg1 = vec3(0.78, 0.89, 0.86);
      vec3 toneA = vec3(0.44, 0.69, 0.62);
      vec3 toneB = vec3(0.56, 0.53, 0.82);
      vec3 toneC = vec3(0.95, 0.99, 0.98);

      col = mix(bg0, bg1, smoothstep(0.15, 0.95, flow));
      col = mix(col, toneA, smoothstep(0.2, 0.8, field) * 0.58);
      col += toneB * max(contours, 0.0) * 0.08;
      col = mix(col, toneC, halo * 0.25 + orbits * 0.08);
      col += vec3(0.84, 0.95, 0.93) * spark * 0.2;
    }

    col += (grain - 0.5) * 0.028;
    col *= 0.98 + 0.02 * sin(t * 0.7 + length(p) * 7.0);
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
