/**
 * # Typescript Wires
 *
 * Declaratively manage asynchronous logic or timed animation.
 *
 * - Check if the wire is live using {@link Wire.isLive} before running logic.
 * - Skip logic if the wire is dead using {@link Wire.isDead}.
 * - React to wire cuts using {@link Wire.once}.
 *
 * ```ts
 * import { breaker, Breaker } from "@tinymirror/wires";
 *
 * const controller = breaker(); // or new Breaker()
 * const wire = controller.wire;
 *
 * if (wire.isDead()) {
 *   // early return
 *   // break
 *   // continue
 * }
 *
 * if (wire.isLive()) {
 *   // run some logic
 * }
 *
 * const unsubscribe = wire.once((reason) => {
 *   // handle cleanup
 * })
 *
 * // cut the wire and abort any running logic
 * // propogate events to all listeners
 * controller.cut()
 *
 * // declarative logic handling
 * function refresh() {
 *   // abort the last run and prepare the next one
 *   const wire = controller.renew()
 *
 *   // run some async logic or animations
 *   // checks if the wire is running after async
 *
 *   const unsubscribe = wire.once(() => {
 *     // handle cancellations
 *     // stop animations
 *     // cleanup values
 *   })
 *
 *   unsubscribe()
 * }
 * ```
 * Wires are extended forms of
 * [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
 * and [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
 *
 * @module
 */
export * from "./wire.ts";
