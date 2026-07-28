/** Salamander 上游的小三度采样网格，A0–C8 共 27 个 */
export const SAMPLE_NOTES = [
  'A0', 'C1', 'Ds1', 'Fs1', 'A1',
  'C2', 'Ds2', 'Fs2', 'A2',
  'C3', 'Ds3', 'Fs3', 'A3',
  'C4', 'Ds4', 'Fs4', 'A4',
  'C5', 'Ds5', 'Fs5', 'A5',
  'C6', 'Ds6', 'A6',
  'C7', 'A7', 'C8',
] as const

export function sampleMap(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of SAMPLE_NOTES) {
    // 文件名沿用上游的 's' 记谱（Ds1.mp3），但 Tone.Sampler 的 urls key 要求标准
    // 音名写法（isNote() 只认 b/#/x/bb 作升降号，认不出 's'）——key 用 '#'，
    // value 仍指向磁盘上真实的 .mp3 文件名，两者故意不同。
    const key = n.replace(/^([A-Ga-g])s(\d+)$/, '$1#$2')
    out[key] = `${n}.mp3`
  }
  return out
}
