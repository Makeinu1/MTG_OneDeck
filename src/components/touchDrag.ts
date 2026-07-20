/**
 * タッチの「短押し=タップ / 長押し=ドラッグ」を分ける単一のしきい値。
 *
 * tap 上限(CardView)と TouchSensor の delay は**必ず同一の値**でなければならない。
 * 別々にハードコードすると両者の間に窓ができ、その保持時間では:
 *   - 窓が tap 上限 < delay 側なら、tap も drag も成立せず、抑止されない合成 click が
 *     マウス用の経路へ落ちる(再タップでメニューが開かず閉じるだけになる)。
 *   - 窓が delay < tap 上限 側なら、ドラッグとタップが**同時に**成立する
 *     (CardView の tap 判定は drag 進行中かを見ない)。
 * 実際に旧UIで後者が起きた(delay 200 のハードコード放置)。
 * `CardView.test.tsx` の「keeps every TouchSensor on the shared activation constraint」が
 * 全 TouchSensor の使用箇所を走査して機械的に強制する。
 */
export const TOUCH_DRAG_DELAY_MS = 320;

/** すべての TouchSensor はこれを使う(delay/tolerance のドリフト防止)。 */
export const TOUCH_DRAG_ACTIVATION = { delay: TOUCH_DRAG_DELAY_MS, tolerance: 10 } as const;
