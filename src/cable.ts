import type { Wire } from "./wire.ts";

/**
 * The Live variant of the {@linkcode Cable}.
 *
 * Holds the carried value.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export interface LiveCable<T, R> {
  /**
   * The state of the {@linkcode Cable}.
   */
  live: true;
  /**
   * The carried value.
   */
  value: T;
  /**
   * The {@linkcode Wire} the {@linkcode Cable} is bound to.
   */
  wire: Wire<R>;
}

/**
 * The Dead variant of the {@linkcode Cable}.
 *
 * Holds no value.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export interface DeadCable<R> {
  /**
   * The state of the {@linkcode Cable}.
   */
  live: false;
  /**
   * Always `undefined`.
   */
  value: undefined;
  /**
   * The {@linkcode Wire} the {@linkcode Cable} is bound to.
   */
  wire: Wire<R>;
}

/**
 * A value bound to a {@linkcode Wire}.
 *
 * A union of {@linkcode LiveCable} and {@linkcode DeadCable}
 * discriminated using the property `live`.
 *
 * A {@linkcode LiveCable} is treated as dead once its {@linkcode Wire} is cut.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export type Cable<T, R> = LiveCable<T, R> | DeadCable<R>;

function live<T, R>(value: T, wire: Wire<R>): LiveCable<T, R> {
  return { live: true, value, wire };
}

function dead<R>(wire: Wire<R>): DeadCable<R> {
  return { live: false, value: undefined, wire };
}

/**
 * Bind a value to a {@linkcode Wire}.
 *
 * Returns a {@linkcode DeadCable} if the {@linkcode Wire} is already dead.
 *
 * @param wire The {@linkcode Wire} to bind the value to.
 * @param value The value to carry.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns A {@linkcode Cable} carrying `value`.
 */
export function wrap<T, R>(wire: Wire<R>, value: T): Cable<T, R> {
  return wire.state.live ? live(value, wire) : dead(wire);
}

/**
 * Shorthand to create a {@linkcode Cable} carrying `undefined`.
 * Equivalent to `wrap(wire, undefined)`.
 *
 * Returns a {@linkcode DeadCable} if the {@linkcode Wire} is already dead.
 *
 * @param wire The {@linkcode Wire} to bind the value to.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns A {@linkcode Cable} carrying `undefined`.
 */
export function empty<R>(wire: Wire<R>): Cable<undefined, R> {
  return wire.state.live ? live(undefined, wire) : dead(wire);
}

/**
 * Get the value carried by a {@linkcode Cable}.
 *
 * @param cable The {@linkcode Cable} to read.
 * @param fallback The value returned if the {@linkcode Cable} or its
 * {@linkcode Wire} is dead.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns The carried value, or `fallback`.
 */
export function unwrap<T, R>(cable: Cable<T, R>, fallback: T): T {
  return cable.live && cable.wire.state.live ? cable.value : fallback;
}

/**
 * Get the value carried by a {@linkcode Cable}.
 *
 * Use over {@linkcode unwrap} when the fallback is expensive to compute.
 *
 * @param cable The {@linkcode Cable} to read.
 * @param fallback Computes the value returned if the {@linkcode Cable} or its
 * {@linkcode Wire} is dead. Only called in that case.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns The carried value, or the result of `fallback`.
 */
export function unwrapLazily<T, R>(
  cable: Cable<T, R>,
  fallback: () => T,
): T {
  return cable.live && cable.wire.state.live ? cable.value : fallback();
}

/**
 * Transform the value carried by a {@linkcode Cable}.
 *
 * `fn` is skipped if the {@linkcode Cable} or its {@linkcode Wire} is dead.
 *
 * @param cable The {@linkcode Cable} to transform.
 * @param fn Transforms the carried value. Also receives the bound
 * {@linkcode Wire}.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @template U The type of the transformed value.
 * @returns A {@linkcode Cable} carrying the transformed value, or a
 * {@linkcode DeadCable}.
 */
export function map<T, R, U>(
  cable: Cable<T, R>,
  fn: (value: T, wire: Wire<R>) => U,
): Cable<U, R> {
  if (!cable.live) return cable;
  if (!cable.wire.state.live) return dead(cable.wire);
  return live(fn(cable.value, cable.wire), cable.wire);
}

/**
 * Run a side effect with the value carried by a {@linkcode Cable}.
 *
 * `fn` is skipped if the {@linkcode Cable} or its {@linkcode Wire} is dead.
 *
 * @param cable The {@linkcode Cable} to read.
 * @param fn The side effect invoked with the carried value and the bound
 * {@linkcode Wire}.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns The same {@linkcode Cable}, or a {@linkcode DeadCable} if the
 * {@linkcode Wire} is dead.
 */
export function tap<T, R>(
  cable: Cable<T, R>,
  fn: (value: T, wire: Wire<R>) => void,
): Cable<T, R> {
  if (!cable.live) return cable;
  if (!cable.wire.state.live) return dead(cable.wire);
  fn(cable.value, cable.wire);
  return cable;
}

/**
 * Transform the value carried by a {@linkcode Cable} using a callback that
 * may be async.
 *
 * `fn` is skipped if the {@linkcode Cable} or its {@linkcode Wire} is dead.
 * The result is a {@linkcode DeadCable} if the {@linkcode Wire} is cut while
 * `fn` runs.
 *
 * Rejects if `fn` rejects, even after the {@linkcode Wire} is cut.
 *
 * @param cable The {@linkcode Cable}, or a promise of one, to transform.
 * @param fn Transforms the carried value. Also receives the bound
 * {@linkcode Wire}.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @template U The type of the transformed value.
 * @returns A promise of a {@linkcode Cable} carrying the transformed value,
 * or a {@linkcode DeadCable}.
 */
export async function mapAsync<T, R, U>(
  cable: Cable<T, R> | Promise<Cable<T, R>>,
  fn: (value: T, wire: Wire<R>) => U | Promise<U>,
): Promise<Cable<U, R>> {
  const awaited = await cable;
  const wire = awaited.wire;

  if (!awaited.live) return awaited;
  if (!wire.state.live) return dead(wire);

  const converted = await fn(awaited.value, wire);

  if (!wire.state.live) return dead(wire);
  return live(converted, wire);
}

/**
 * Run a side effect that may be async with the value carried by a
 * {@linkcode Cable}.
 *
 * `fn` is skipped if the {@linkcode Cable} or its {@linkcode Wire} is dead.
 * The result is a {@linkcode DeadCable} if the {@linkcode Wire} is cut while
 * `fn` runs.
 *
 * Rejects if `fn` rejects, even after the {@linkcode Wire} is cut.
 *
 * @param cable The {@linkcode Cable}, or a promise of one, to read.
 * @param fn The side effect invoked with the carried value and the bound
 * {@linkcode Wire}.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns A promise of the same {@linkcode Cable}, or a {@linkcode DeadCable}.
 */
export async function tapAsync<T, R>(
  cable: Cable<T, R> | Promise<Cable<T, R>>,
  fn: (value: T, wire: Wire<R>) => void | Promise<void>,
): Promise<Cable<T, R>> {
  const awaited = await cable;
  const wire = awaited.wire;

  if (!awaited.live) return awaited;
  if (!wire.state.live) return dead(wire);

  await fn(awaited.value, wire);

  if (!wire.state.live) return dead(wire);

  return awaited;
}
