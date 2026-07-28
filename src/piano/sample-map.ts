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
  for (const n of SAMPLE_NOTES) out[n] = `${n}.mp3`
  return out
}
