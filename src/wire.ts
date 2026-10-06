/**
 * The Live variant of the {@linkcode WireState}.
 */
export interface LiveWireState {
  /**
   * The state of the {@linkcode Wire}.
   */
  live: true;
}

/**
 * The Dead variant of the {@linkcode WireState}.
 *
 * Includes the reason the {@linkcode Wire} is dead.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export interface DeadWireState<R = undefined> {
  /**
   * The state of the {@linkcode Wire}.
   */
  live: false;
  /**
   * The reason the {@linkcode Wire} is dead.
   */
  reason: R;
}

/**
 * The state of a {@linkcode Wire}.
 *
 * A union of {@linkcode LiveWireState} and {@linkcode DeadWireState}
 * discriminated using the property `live`.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export type WireState<R = undefined> = LiveWireState | DeadWireState<R>;

/**
 * The read-only interface for a {@linkcode LiveWireState}.
 *
 * The Live variant of the {@linkcode WireState}.
 */
export interface ReadonlyLiveWireState extends LiveWireState {
  /**
   * The state of the {@linkcode Wire}.
   */
  readonly live: true;
}

/**
 * The read-only interface for a {@linkcode DeadWireState}.
 *
 * The Dead variant of the {@linkcode WireState}.
 *
 * Includes the reason the {@linkcode Wire} is dead.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export interface ReadonlyDeadWireState<R = undefined> extends DeadWireState<R> {
  /**
   * The state of the {@linkcode Wire}.
   */
  readonly live: false;
  /**
   * The reason the {@linkcode Wire} is dead.
   */
  readonly reason: R;
}

/**
 * The read-only interface for a {@linkcode WireState}.
 *
 * The state of a {@linkcode Wire}.
 *
 * A union of {@linkcode LiveWireState} and {@linkcode DeadWireState}
 * discriminated using the property `live`.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export type ReadonlyWireState<R = undefined> =
  | ReadonlyLiveWireState
  | ReadonlyDeadWireState<R>;

function createLiveWireState(): LiveWireState {
  return { live: true };
}

function createDeadWireState<R = undefined>(reason: R): DeadWireState<R> {
  return { live: false, reason };
}

const NOOP = () => {};

/**
 * The arguments of `cut` and `reset`.
 *
 * `reason` is optional when `undefined` is a valid reason, otherwise required.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export type CutArgs<R> = undefined extends R ? [reason?: R] : [reason: R];

/**
 * The callback invoked when a {@linkcode Wire} is cut.
 *
 * @param reason The reason the {@linkcode Wire} is cut.
 */
export type WireCutCallback<R = undefined> = (reason: R) => void;

/**
 * The read-only interface for a {@linkcode Wire}. It has no `cut`.
 *
 * Use it to type wires that should not be cut, such as wires passed as
 * arguments.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export interface ReadonlyWire<R = undefined> {
  /**
   * The current state of the {@linkcode Wire}.
   */
  readonly state: ReadonlyWireState<R>;

  /**
   * The reason the {@linkcode Wire} is dead.
   *
   * Is `undefined` if the {@linkcode Wire} is live.
   */
  readonly reason: R | undefined;

  /**
   * Whether the {@linkcode Wire} is live.
   */
  isLive(): this is this & { state: ReadonlyLiveWireState };

  /**
   * Whether the {@linkcode Wire} is dead.
   */
  isDead(): this is this & { state: ReadonlyDeadWireState<R> };

  /**
   * Listen to when the {@linkcode Wire} is cut.
   *
   * See {@linkcode Wire.once}.
   */
  once(fun: WireCutCallback<R>): () => void;
}

/**
 * Declaratively manage asynchronous logic or timed animation.
 *
 * - Check if the wire is live using {@linkcode Wire.isLive} before running logic.
 * - Skip logic if the wire is dead using {@linkcode Wire.isDead}.
 * - React to wire cuts using {@linkcode Wire.once}.
 * - Connect and propagate cuts using {@linkcode Wire.connect}.
 *
 * **Note**: It is recommended that you create and control wires through the
 * {@linkcode Breaker} rather than on the {@linkcode Wire} directly.
 * See "Anti Patterns" in module documentation. You can still use {@linkcode Wire}
 * directly should you wish to.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export class Wire<R = undefined> implements ReadonlyWire<R> {
  /**
   * The current state of the {@linkcode Wire}.
   */
  protected current: WireState<R> = createLiveWireState();

  /**
   * The next callback index used as the key
   * for the next callback in {@linkcode Wire.callbacks}.
   */
  protected nextCallbackIndex = 0;

  /**
   * The callback map emitted when {@linkcode Wire.cut}
   * is called.
   */
  protected callbacks: Map<number, WireCutCallback<R>> = new Map();

  /**
   * The current state of the {@linkcode Wire}
   */
  public get state(): ReadonlyWireState<R> {
    return this.current;
  }

  /**
   * Whether the {@linkcode Wire} is live.
   */
  public isLive(): this is typeof this & { state: ReadonlyLiveWireState } {
    return this.current.live;
  }

  /**
   * Whether the {@linkcode Wire} is dead.
   */
  public isDead(): this is typeof this & { state: ReadonlyDeadWireState<R> } {
    return !this.current.live;
  }

  /**
   * The reason the {@linkcode Wire} is dead.
   *
   * Is `undefined` if the {@linkcode Wire} is live.
   */
  public get reason(): R | undefined {
    return this.current.live ? undefined : this.current.reason;
  }

  /**
   * Listen to when the {@linkcode Wire} is cut.
   *
   * The callback is automatically unsubscribed after the first
   * invocation.
   *
   * Use the returned function to unsubscribe early.
   *
   * If the {@linkcode Wire} is already dead, `fun` is called immediately.
   *
   * `fun` should catch and handle its own errors. If the {@linkcode Wire}
   * is already dead, an error thrown by `fun` propagates to the caller.
   *
   * @param fun The callback invoked when a {@linkcode Wire} is cut.
   * @returns A function to unsubscribe from the {@linkcode Wire}'s cut
   * event.
   */
  public once(fun: WireCutCallback<R>): () => void {
    if (!this.current.live) {
      fun(this.current.reason);
      return NOOP;
    }

    const id = this.nextCallbackIndex++;
    this.callbacks.set(id, fun);
    return () => {
      this.callbacks.delete(id);
    };
  }

  /**
   * Cut the {@linkcode Wire} and invoke all callbacks.
   *
   * The {@linkcode Wire} is dead before the callbacks are invoked. Does
   * nothing if it is already dead.
   *
   * An error thrown by a callback propagates to the caller and the remaining
   * callbacks are not invoked.
   *
   * `reason` is optional only when `undefined` is a valid reason, see
   * {@linkcode CutArgs}.
   *
   * @param args The reason the {@linkcode Wire} is cut.
   */
  public cut(...args: CutArgs<R>): void {
    if (!this.current.live) return;
    const reason = args[0] as R;
    this.current = createDeadWireState(reason);
    // Iterate the map itself so a listener can unsubscribe the ones after it.
    for (const [id, fun] of this.callbacks) {
      this.callbacks.delete(id);
      fun(reason);
    }
  }

  /**
   * Connect this {@linkcode Wire} to a parent {@linkcode Wire}.
   *
   * When the parent {@linkcode Wire} is cut, this {@linkcode Wire} is also cut
   * with the same reason. If the parent is already dead, this
   * {@linkcode Wire} is cut immediately.
   *
   * The connection is removed once either {@linkcode Wire} is cut.
   *
   * @param wire The parent {@linkcode Wire} to connect to.
   * @returns A function to disconnect from the parent {@linkcode Wire}.
   */
  public connect(wire: ReadonlyWire<R>): () => void {
    const unsubscribeParent = wire.once((reason) => this.cut(reason));
    const unsubscribeSelf = this.once(unsubscribeParent);
    return () => {
      unsubscribeParent();
      unsubscribeSelf();
    };
  }
}

/**
 * Create a new {@linkcode Wire}. Equivalent to `new Wire<R>()`.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns A new {@linkcode Wire}.
 */
export function wire<R = undefined>(): Wire<R> {
  return new Wire<R>();
}

/**
 * Declaratively manage asynchronous logic or timed animation.
 *
 * - Start a run using {@linkcode Breaker.reset}. It cuts the previous run and
 *   returns the {@linkcode Wire} for this run.
 * - Check that {@linkcode Wire} before running logic and after each `await`.
 * - Cut the current run using {@linkcode Breaker.cut}.
 *
 * **Note**: {@linkcode Breaker.isLive} and {@linkcode Breaker.isDead} read the
 * latest {@linkcode Wire}. After an `await`, it can belong to a newer run.
 * Inside a run, check the {@linkcode Wire} that {@linkcode Breaker.reset}
 * returned.
 *
 * It is recommended that you create and control wires through the
 * {@linkcode Breaker} rather than on the {@linkcode Wire} directly.
 * See "Anti Patterns" in module documentation. You can still use {@linkcode Wire}
 * directly should you wish to.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export class Breaker<R = undefined> {
  /**
   * The current {@linkcode Wire} instance.
   *
   * Rotated out when {@linkcode Breaker.reset} is called.
   */
  protected current: Wire<R> = new Wire();

  /**
   * The current {@linkcode Wire} instance.
   *
   * Rotated out when {@linkcode Breaker.reset} is called.
   */
  public get wire(): Wire<R> {
    return this.current;
  }

  /**
   * The reason the {@linkcode Breaker} is dead.
   *
   * Is `undefined` if the {@linkcode Breaker} is live.
   */
  public get reason(): R | undefined {
    return this.current.reason;
  }

  /**
   * Whether the {@linkcode Breaker} is live.
   *
   * Reads the latest {@linkcode Wire}, which can belong to a newer run.
   */
  public isLive(): this is typeof this & {
    wire: Wire<R> & { state: ReadonlyLiveWireState };
  } {
    return this.current.isLive();
  }

  /**
   * Whether the {@linkcode Breaker} is dead.
   *
   * Reads the latest {@linkcode Wire}, which can belong to a newer run.
   */
  public isDead(): this is typeof this & {
    wire: Wire<R> & { state: ReadonlyDeadWireState<R> };
  } {
    return this.current.isDead();
  }

  /**
   * Cut the {@linkcode Breaker}'s current {@linkcode Wire} and invoke all
   * callbacks.
   *
   * See {@linkcode Wire.cut}.
   *
   * @param args The reason the {@linkcode Wire} is cut.
   */
  public cut(...args: CutArgs<R>): void {
    this.current.cut(...args);
  }

  /**
   * Cut the {@linkcode Breaker}'s current {@linkcode Wire} and replace it with
   * a new live {@linkcode Wire}.
   *
   * The new {@linkcode Wire} is installed even if a callback throws. The error
   * then propagates to the caller; read {@linkcode Breaker.wire} to get the
   * new {@linkcode Wire}.
   *
   * The reason is ignored if the current {@linkcode Wire} is already dead.
   * `reason` is optional only when `undefined` is a valid reason, see
   * {@linkcode CutArgs}.
   *
   * @param args The reason the previous {@linkcode Wire} is cut.
   * @returns The new live {@linkcode Wire}.
   */
  public reset(...args: CutArgs<R>): Wire<R> {
    try {
      this.cut(...args);
    } finally {
      // A throwing listener must not leave the breaker holding a dead wire.
      this.current = new Wire<R>();
    }
    return this.current;
  }
}

/**
 * Create a new {@linkcode Breaker}. Equivalent to `new Breaker<R>()`.
 *
 * @template R The type of the reason the {@linkcode Breaker} is dead.
 * @returns A new {@linkcode Breaker}.
 */
export function breaker<R = undefined>(): Breaker<R> {
  return new Breaker<R>();
}
