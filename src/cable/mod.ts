/**
 * # Cables
 *
 * Bind values to a {@linkcode Wire} and transform them only while the
 * {@linkcode Wire} is live.
 *
 * - Bind a value using {@linkcode wrap}.
 * - Transform it using {@linkcode map}, {@linkcode tap}, {@linkcode mapAsync}, or
 *   {@linkcode tapAsync}.
 * - Read it back using {@linkcode unwrap} or {@linkcode unwrapLazily}.
 *
 * Once the {@linkcode Wire} is cut, callbacks are skipped and the
 * {@linkcode Cable} turns dead. This includes cuts that happen while an
 * async callback is running.
 *
 * ## Direct usage (recommended)
 *
 * Each utility function returns a {@linkcode Cable} for the next step. Async
 * steps return a promise of a {@linkcode Cable}, which you `await` yourself.
 *
 * This is currently the optimized way to use cables.
 *
 * ```ts
 * import { breaker } from "@tinymirror/wires";
 * import { map, mapAsync, tap, unwrap, wrap } from "@tinymirror/wires/cable";
 *
 * const controller = breaker();
 *
 * const count = wrap(controller.wire, 1);
 * const doubled = map(count, (n) => n * 2);
 *
 * // await async steps yourself, then continue with the returned cable
 * const label = await mapAsync(doubled, async (n) => {
 *   // cutting the wire here turns `label` dead
 *   await new Promise((resolve) => setTimeout(resolve, 100));
 *   return `${n}`;
 * });
 *
 * tap(label, (text) => console.log(text)); // skipped if the wire was cut
 *
 * const result = unwrap(label, "cancelled"); // "2", or "cancelled"
 * ```
 *
 * ## Chains
 *
 * {@linkcode wrapIntoChain} and {@linkcode chain} pipe the same steps together and
 * handle the async unwrapping and rewrapping for you. They are not
 * optimized yet, so prefer direct usage.
 *
 * ```ts
 * import { breaker } from "@tinymirror/wires";
 * import { wrapIntoChain } from "@tinymirror/wires/cable";
 *
 * const controller = breaker();
 *
 * // unwrap gives you the promise of the final value,
 * // or the default value if the wire was cut.
 * // await the promise to get the value.
 * const label = await wrapIntoChain(controller.wire, 1)
 *   .map((n) => n * 2)
 *   .mapAsync(async (n) => {
 *     // do something asynchronously
 *     return Promise.resolve(`${n}`);
 *   })
 *   .unwrap("cancelled");
 * ```
 *
 * @module
 */
export * from "./cable.ts";
