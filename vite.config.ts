import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'node:path'
import { cpSync, existsSync } from 'node:fs'

/**
 * main.ts 用 `new URL('./assets/salamander/', import.meta.url)` 定位采样目录——
 * 这是个目录引用而非具体文件，Vite 的静态资源分析认不出来，构建时会原样保留这行代码
 * （见 `vite build` 的 "doesn't exist at build time" 警告），不会把采样文件一起打进 dist。
 *
 * 构建产物里 piano 入口的 JS 落在 `dist/assets/piano-*.js`；运行时它自己的
 * import.meta.url 就是这个文件的 URL，相对路径 './assets/salamander/' 是相对
 * "所在目录"（dist/assets/）再拼一层 assets/salamander，算出来是
 * `dist/assets/assets/salamander/`。这个插件就是把采样样本复制到这个位置，
 * 让生产环境和 `vite dev`（此时该相对路径直接落在 src/piano/assets/salamander/，
 * 天然可用）行为一致。
 */
function copySalamanderSamples(): Plugin {
  const src = resolve(__dirname, 'src/piano/assets/salamander')
  return {
    name: 'copy-salamander-samples',
    closeBundle() {
      if (!existsSync(src)) return
      const dest = resolve(__dirname, 'dist/assets/assets/salamander')
      cpSync(src, dest, { recursive: true })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [copySalamanderSamples()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        journey: resolve(__dirname, 'journey.html'),
        profile: resolve(__dirname, 'profile.html'),
        piano: resolve(__dirname, 'piano.html'),
      },
    },
  },
})
