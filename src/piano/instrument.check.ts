// instrument.ts 的纯逻辑自检。跑法：node src/piano/instrument.check.ts
import assert from 'node:assert'
import { readdirSync } from 'node:fs'
import { SAMPLE_NOTES, sampleMap } from './sample-map.ts'

// 27 个采样，低到高
assert.equal(SAMPLE_NOTES.length, 27, '采样数应为 27')
assert.equal(SAMPLE_NOTES[0], 'A0')
assert.equal(SAMPLE_NOTES[SAMPLE_NOTES.length - 1], 'C8')

// 音名只允许 C / Ds / Fs / A 四种字母部分
for (const n of SAMPLE_NOTES) {
  const letter = n.replace(/\d+$/, '')
  assert.ok(['C', 'Ds', 'Fs', 'A'].includes(letter), `非法采样音名 ${n}`)
}

// sampleMap 与文件系统一致
const map = sampleMap()
assert.equal(Object.keys(map).length, 27)
assert.equal(map['C4'], 'C4.mp3')

const onDisk = readdirSync(new URL('./assets/salamander/', import.meta.url)).filter((f) =>
  f.endsWith('.mp3'),
)
assert.equal(onDisk.length, 27, '磁盘上的采样文件数与 SAMPLE_NOTES 不一致')
for (const n of SAMPLE_NOTES) {
  assert.ok(onDisk.includes(`${n}.mp3`), `缺少采样文件 ${n}.mp3`)
}

console.log('instrument.check.ts OK')
