import * as THREE from 'three';

export class AstraParticles {
  public points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private count: number;
  private originalPositions: Float32Array;
  private velocities: Float32Array;

  constructor(count: number = 1200) {
    this.count = count;
    this.geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    this.originalPositions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const colCyan = new THREE.Color(0x00f0ff);
    const colPurple = new THREE.Color(0x9d72ff);
    const colGold = new THREE.Color(0xffd700);

    for (let i = 0; i < count; i++) {
      // Spread across normalized NDC space [-1, 1]
      const x = (Math.random() - 0.5) * 2.2;
      const y = (Math.random() - 0.5) * 2.2;
      const z = (Math.random() - 0.5) * 0.5;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.originalPositions[i * 3] = x;
      this.originalPositions[i * 3 + 1] = y;
      this.originalPositions[i * 3 + 2] = z;

      scales[i] = Math.random() * 2.5 + 1.0;
      phases[i] = Math.random() * Math.PI * 2;

      // Color distribution: mostly cyan/purple, sparse gold
      const rand = Math.random();
      const c = rand < 0.6 ? colCyan : rand < 0.9 ? colPurple : colGold;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_dpr: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute float aScale;
        attribute float aPhase;
        attribute vec3 aColor;

        uniform float u_time;
        uniform float u_dpr;

        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = aColor;
          // Breathing scale & opacity
          float pulse = sin(u_time * 1.5 + aPhase) * 0.4 + 0.6;
          vAlpha = pulse * 0.75;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aScale * u_dpr * pulse * (1.5 / -mvPosition.z);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          // Circular particle with soft radiant edge
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float glow = smoothstep(0.5, 0.05, dist);
          gl_FragColor = vec4(vColor, vAlpha * glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
  }

  public update(time: number, mouseNdc: THREE.Vector2, mouseVelocity: number): void {
    this.material.uniforms.u_time.value = time;

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const ox = this.originalPositions[idx];
      const oy = this.originalPositions[idx + 1];

      let px = pos[idx];
      let py = pos[idx + 1];

      // Natural subtle drift
      const driftX = Math.cos(time * 0.4 + i) * 0.0008;
      const driftY = Math.sin(time * 0.4 + i) * 0.0008;

      // Mouse attraction / displacement
      const dx = px - mouseNdc.x;
      const dy = py - mouseNdc.y;
      const distSq = dx * dx + dy * dy;

      let forceX = 0;
      let forceY = 0;
      if (distSq < 0.25) {
        const dist = Math.max(Math.sqrt(distSq), 0.02);
        // Repulsion when fast, attraction when slow
        const factor = (mouseVelocity > 0.05 ? 0.008 : -0.004) / dist;
        forceX = (dx / dist) * factor;
        forceY = (dy / dist) * factor;
      }

      // Spring back to original positions
      const springX = (ox - px) * 0.02;
      const springY = (oy - py) * 0.02;

      this.velocities[idx] = (this.velocities[idx] + forceX + springX + driftX) * 0.88;
      this.velocities[idx + 1] = (this.velocities[idx + 1] + forceY + springY + driftY) * 0.88;

      pos[idx] += this.velocities[idx];
      pos[idx + 1] += this.velocities[idx + 1];
    }

    posAttr.needsUpdate = true;
  }

  public setDpr(dpr: number): void {
    if (this.material.uniforms.u_dpr) {
      this.material.uniforms.u_dpr.value = dpr;
    }
  }

  public destroy(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
