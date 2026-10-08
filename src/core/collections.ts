/** 稳定地就地清理实体，保留顺序与数组引用，避免每帧生成新的筛选数组。 */
export function compactInPlace<T>(values: T[], keep: (value: T) => boolean): void {
  let write = 0
  for (let read = 0; read < values.length; read++) {
    const value = values[read]
    if (keep(value)) values[write++] = value
  }
  values.length = write
}
