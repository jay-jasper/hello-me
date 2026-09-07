import * as THREE from 'three';
import { auroraVertexShader } from './shaders/aurora.vert';
import { auroraFragmentShader } from './shaders/aurora.frag';
import { AstraParticles } from './particles';

export interface AstraNebulaOptions {
  canvas: HTMLCanvasElement;
  colors?: {
    primary?: string;     // default: '#7952ff'
    secondary?: string;   // default: '#00f0ff'
    accent?: string;      // default: '#ffd700'
    background?: string;  // default: '#06080e'
  };
  fluidSpeed?: number;
  particleCount?: number;
  enableMouseInteraction?: boolean;
  dprLimit?: number;
}

export class AstraNebula {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private auroraMesh: THREE.Mesh;
  private auroraMaterial: THREE.RawShaderMaterial;
  private particles: AstraParticles | null = null;

  private clock: THREE.Clock;
  private animationFrameId: number = 0;
  private isDestroyed: boolean = false;
  private isVisible: boolean = true;
  private prefersReducedMotion: boolean = false;

  private mouse = new THREE.Vector2(0.5, 0.5);
  private mouseNdc = new THREE.Vector2(0, 0);
  private targetMouse = new THREE.Vector2(0.5, 0.5);
  private lastMouse = new THREE.Vector2(0.5, 0.5);
  private mouseVelocity: number = 0;
  private scrollProgress: number = 0;
  private targetScrollProgress: number = 0;

  private options: Required<AstraNebulaOptions>;

  constructor(options: AstraNebulaOptions) {
    this.canvas = options.canvas;
    this.options = {
      canvas: options.canvas,
      colors: {
        primary: options.colors?.primary ?? '#7952ff',
        secondary: options.colors?.secondary ?? '#00f0ff',
        accent: options.colors?.accent ?? '#ffd700',
        background: options.colors?.background ?? '#06080e',
      },
      fluidSpeed: options.fluidSpeed ?? 1.0,
      particleCount: options.particleCount ?? 1200,
      enableMouseInteraction: options.enableMouseInteraction ?? true,
      dprLimit: options.dprLimit ?? 2,
    };

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.options.dprLimit));

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.clock = new THREE.Clock();

    // Aurora Background Plane
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.auroraMaterial = new THREE.RawShaderMaterial({
      vertexShader: auroraVertexShader,
      fragmentShader: auroraFragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_mouse_velocity: { value: 0.0 },
        u_scroll: { value: 0.0 },
        u_color_bg: { value: new THREE.Color(this.options.colors.background) },
        u_color_primary: { value: new THREE.Color(this.options.colors.primary) },
        u_color_secondary: { value: new THREE.Color(this.options.colors.secondary) },
        u_color_accent: { value: new THREE.Color(this.options.colors.accent) },
        u_intensity: { value: 1.0 },
      },
      depthWrite: false,
      depthTest: false,
    });
    this.auroraMesh = new THREE.Mesh(geometry, this.auroraMaterial);
    this.scene.add(this.auroraMesh);

    // Stardust Particle system
    if (this.options.particleCount > 0) {
      this.particles = new AstraParticles(this.options.particleCount);
      this.scene.add(this.particles.points);
    }

    this.bindEvents();
    this.resize();
    this.startLoop();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    if (this.options.enableMouseInteraction) {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    const x = e.clientX / window.innerWidth;
    const y = 1.0 - e.clientY / window.innerHeight; // invert for WebGL st coordinates
    this.targetMouse.set(x, y);

    // NDC [-1, 1]
    this.mouseNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  };

  private onResize = (): void => {
    this.resize();
  };

  private onVisibilityChange = (): void => {
    this.isVisible = !document.hidden;
    if (this.isVisible) {
      this.clock.start();
    }
  };

  public setScrollProgress(progress: number): void {
    this.targetScrollProgress = Math.max(0, Math.min(1, progress));
  }

  public setColors(colors: Partial<NonNullable<AstraNebulaOptions['colors']>>): void {
    if (colors.background) {
      this.auroraMaterial.uniforms.u_color_bg.value.set(colors.background);
    }
    if (colors.primary) {
      this.auroraMaterial.uniforms.u_color_primary.value.set(colors.primary);
    }
    if (colors.secondary) {
      this.auroraMaterial.uniforms.u_color_secondary.value.set(colors.secondary);
    }
    if (colors.accent) {
      this.auroraMaterial.uniforms.u_color_accent.value.set(colors.accent);
    }
  }

  public setIntensity(intensity: number): void {
    this.auroraMaterial.uniforms.u_intensity.value = intensity;
  }

  public resize(): void {
    const width = this.canvas.parentElement?.clientWidth || window.innerWidth;
    const height = this.canvas.parentElement?.clientHeight || window.innerHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, this.options.dprLimit);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    this.auroraMaterial.uniforms.u_resolution.value.set(width * dpr, height * dpr);
    if (this.particles) {
      this.particles.setDpr(dpr);
    }
  }

  private startLoop(): void {
    const loop = () => {
      if (this.isDestroyed) return;

      if (this.isVisible) {
        const delta = Math.min(this.clock.getDelta(), 0.1);
        const speed = this.prefersReducedMotion ? 0.15 : this.options.fluidSpeed;
        const elapsedTime = this.clock.getElapsedTime() * speed;

        // Smooth mouse lerping
        const mouseDelta = this.targetMouse.distanceTo(this.lastMouse);
        this.mouseVelocity = THREE.MathUtils.lerp(this.mouseVelocity, mouseDelta * 10, 0.1);
        this.lastMouse.copy(this.targetMouse);

        this.mouse.lerp(this.targetMouse, 0.08);
        this.scrollProgress = THREE.MathUtils.lerp(this.scrollProgress, this.targetScrollProgress, 0.06);

        // Update uniforms
        this.auroraMaterial.uniforms.u_time.value = elapsedTime;
        this.auroraMaterial.uniforms.u_mouse.value.copy(this.mouse);
        this.auroraMaterial.uniforms.u_mouse_velocity.value = this.mouseVelocity;
        this.auroraMaterial.uniforms.u_scroll.value = this.scrollProgress;

        // Update particles
        if (this.particles) {
          this.particles.update(elapsedTime, this.mouseNdc, this.mouseVelocity);
        }

        this.renderer.render(this.scene, this.camera);
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public destroy(): void {
    this.isDestroyed = true;
    cancelAnimationFrame(this.animationFrameId);

    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pointermove', this.onPointerMove);

    if (this.particles) {
      this.particles.destroy();
    }

    this.auroraMesh.geometry.dispose();
    this.auroraMaterial.dispose();
    this.renderer.dispose();
  }
}
