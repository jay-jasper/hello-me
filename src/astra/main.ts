import { AstraNebula } from './effects/AstraNebula';
import { astraData } from './content/data';

function initContent(): void {
  // Render Hero
  const heroName = document.getElementById('hero-name');
  const heroSub = document.getElementById('hero-sub');
  const heroMetrics = document.getElementById('hero-metrics');

  if (heroName) heroName.textContent = astraData.identity.name;
  if (heroSub) heroSub.textContent = astraData.identity.bio;

  if (heroMetrics) {
    heroMetrics.innerHTML = astraData.identity.metrics
      .map(
        (m) => `
        <div class="metric-card">
          <div class="metric-label">${m.label}</div>
          <div class="metric-value">${m.value}</div>
        </div>
      `
      )
      .join('');
  }

  // Render Projects
  const projectsGrid = document.getElementById('projects-grid');
  if (projectsGrid) {
    projectsGrid.innerHTML = astraData.projects
      .map(
        (p) => `
        <article class="project-card">
          <div class="project-category">${p.category}</div>
          <h3 class="project-title">${p.title}</h3>
          <p class="project-desc">${p.description}</p>
          <ul class="project-tags">
            ${p.tags.map((t) => `<li class="project-tag">${t}</li>`).join('')}
          </ul>
          ${p.link ? `<a href="${p.link}" class="project-action">${p.linkText || '探索 →'}</a>` : ''}
        </article>
      `
      )
      .join('');
  }

  // Render Logs
  const logsList = document.getElementById('logs-list');
  if (logsList) {
    logsList.innerHTML = astraData.logs
      .map(
        (l) => `
        <div class="log-entry">
          <div class="log-meta">
            <span class="log-epoch">${l.epoch}</span>
            <span class="log-coord">${l.coordinates}</span>
          </div>
          <h3 class="log-title">${l.title}</h3>
          <p class="log-content">${l.content}</p>
        </div>
      `
      )
      .join('');
  }

  // Render Footer Links
  const footerLinks = document.getElementById('footer-links');
  if (footerLinks) {
    footerLinks.innerHTML = astraData.links
      .map(
        (lnk) => `
        <li><a href="${lnk.url}" title="${lnk.note}">${lnk.name}</a></li>
      `
      )
      .join('');
  }
}

function initEffects(): void {
  const canvas = document.getElementById('astra-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  // Instantiate reusable AstraNebula
  const nebula = new AstraNebula({
    canvas,
    fluidSpeed: 0.9,
    particleCount: 1400,
    enableMouseInteraction: true,
  });

  // Connect scroll to fluid evolution
  const updateScroll = () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = totalHeight > 0 ? window.scrollY / totalHeight : 0;
    nebula.setScrollProgress(progress);
  };

  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();
}

window.addEventListener('DOMContentLoaded', () => {
  initContent();
  initEffects();
});
