/**
 * # Chains
 *
 * A chainable interface over a {@linkcode Cable}.
 *
 * {@linkcode wrapIntoChain} and {@linkcode chain} pipe the cable utilities
 * from `@tinymirror/wires` together and handle the async unwrapping and
 * rewrapping for you. They are not optimized yet, so prefer using the cable
 * utilities directly.
 *
 * Once the {@linkcode Wire} is cut, callbacks are skipped.
 *
 * ```ts
 * import { breaker } from "@tinymirror/wires";
 * import { wrapIntoChain } from "@tinymirror/wires/chain";
 *
 * const controller = breaker();
 *
 * // unwrap gives you the promise of the final value,
 * // or the default value if the wire was cut.
 * // await the promise to get the value.
 * const label = await wrapIntoChain(controller.wire, 1)
 *   .map((n) => n * 2)
 *   .mapAsync((n): Promise<string> => {
 *     // do something asynchronously
 *     return Promise.resolve(`${n}`);
 *   })
 *   .unwrap("cancelled"); // "2", or "cancelled" if the wire was cut
 * ```
 *
 * @module
 */
export * from "./chain.ts";
