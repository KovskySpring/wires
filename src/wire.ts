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

// Node has no `reportError`: rethrow in a microtask to raise `uncaughtException`.
const report: (error: unknown) => void =
  typeof globalThis.reportError === "function"
    ? (error) => globalThis.reportError(error)
    : (error) =>
      queueMicrotask(() => {
        throw error;
      });

/**
 * The callback invoked when a {@linkcode Wire} is cut.
 *
 * @param reason The reason the {@linkcode Wire} is cut.
 */
export type WireCutCallback<R = undefined> = (reason: R) => void;

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
export class Wire<R = undefined> {
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
   * `fun` should catch and handle its own errors. Errors thrown are
   * reported with `reportError`.
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
   * Cut a {@linkcode Wire} and invoke all callbacks.
   *
   * The {@linkcode Wire} will be set to dead before the callbacks
   * are invoked.
   *
   * Does nothing if the {@linkcode Wire} is already dead.
   *
   * If the reason type is `undefined` you can leave the param
   * `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Wire<T>` is not assignable
   * to method's `this` of type `Wire<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@linkcode Wire} is cut.
   * @template R The type of the reason the {@linkcode Wire} is dead.
   */
  public cut(this: Wire<undefined>, reason?: R): void;
  /**
   * Cut a {@linkcode Wire} and invoke all callbacks.
   *
   * The {@linkcode Wire} will be set to dead before the callbacks
   * are invoked.
   *
   * Does nothing if the {@linkcode Wire} is already dead.
   *
   * If the reason type is `undefined` you can leave the param
   * `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Wire<T>` is not assignable
   * to method's `this` of type `Wire<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@linkcode Wire} is cut.
   * @template R The type of the reason the {@linkcode Wire} is dead.
   */
  public cut<R>(this: Wire<R>, reason: R): void;
  /**
   * Cut a {@linkcode Wire} and invoke all callbacks.
   *
   * The {@linkcode Wire} will be set to dead before the callbacks
   * are invoked.
   *
   * Does nothing if the {@linkcode Wire} is already dead.
   *
   * If the reason type is `undefined` you can leave the param
   * `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Wire<T>` is not assignable
   * to method's `this` of type `Wire<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@linkcode Wire} is cut.
   * @template R The type of the reason the {@linkcode Wire} is dead.
   */
  public cut(reason: R): void {
    if (!this.current.live) return;
    this.current = createDeadWireState(reason);
    const funs = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const fun of funs) {
      try {
        fun(reason);
      } catch (error) {
        report(error);
      }
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
  public connect(wire: Wire<R>): () => void {
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
 * - Check if the wire is live using {@linkcode Breaker.isLive} before running logic.
 * - Skip logic if the wire is dead using {@linkcode Breaker.isDead}.
 * - React to wire cuts using {@linkcode Breaker.wire.once}.
 *
 * **Note**: It is recommended that you create and control wires through the
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
   */
  public isLive(): this is typeof this & {
    wire: Wire<R> & { state: ReadonlyLiveWireState };
  } {
    return this.current.isLive();
  }

  /**
   * Whether the {@linkcode Breaker} is dead.
   */
  public isDead(): this is typeof this & {
    wire: Wire<R> & { state: ReadonlyDeadWireState<R> };
  } {
    return this.current.isDead();
  }

  /**
   * Cut the {@linkcode Breaker}'s current {@linkcode Wire} and invoke all callbacks.
   *
   * The {@linkcode Breaker} will be set to dead before the callbacks
   * are invoked.
   *
   * Does nothing if the current {@linkcode Wire} is already dead.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@linkcode Breaker} is cut.
   * @template R The type of the reason the {@linkcode Breaker} is dead.
   */
  public cut(this: Breaker<undefined>, reason?: R): void;
  /**
   * Cut the {@linkcode Breaker}'s current {@linkcode Wire} and invoke all callbacks.
   *
   * The {@linkcode Breaker} will be set to dead before the callbacks
   * are invoked.
   *
   * Does nothing if the current {@linkcode Wire} is already dead.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@linkcode Breaker} is cut.
   * @template R The type of the reason the {@linkcode Breaker} is dead.
   */
  public cut<R>(this: Breaker<R>, reason: R): void;
  /**
   * Cut the {@linkcode Breaker}'s current {@linkcode Wire} and invoke all callbacks.
   *
   * The {@linkcode Breaker} will be set to dead before the callbacks
   * are invoked.
   *
   * Does nothing if the current {@linkcode Wire} is already dead.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@linkcode Breaker} is cut.
   * @template R The type of the reason the {@linkcode Breaker} is dead.
   */
  public cut(reason: R): void {
    this.current.cut(reason);
  }

  /**
   * Reset the {@linkcode Breaker}'s current {@linkcode Wire} to a new live {@linkcode Wire}.
   *
   * `reason` is ignored if the current {@linkcode Wire} is already dead.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your reset. `reason` is required in this scenario.
   *
   * @param reason The reason the {@linkcode Breaker} is reset.
   * @template R The type of the reason the {@linkcode Breaker} is dead.
   */
  public reset(this: Breaker<undefined>, reason?: R): Wire<R>;
  /**
   * Reset the {@linkcode Breaker}'s current {@linkcode Wire} to a new live {@linkcode Wire}.
   *
   * `reason` is ignored if the current {@linkcode Wire} is already dead.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your reset. `reason` is required in this scenario.
   *
   * @param reason The reason the {@linkcode Breaker} is reset.
   * @template R The type of the reason the {@linkcode Breaker} is dead.
   */
  public reset<R>(this: Breaker<R>, reason: R): Wire<R>;
  /**
   * Reset the {@linkcode Breaker}'s current {@linkcode Wire} to a new live {@linkcode Wire}.
   *
   * `reason` is ignored if the current {@linkcode Wire} is already dead.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your reset. `reason` is required in this scenario.
   *
   * @param reason The reason the {@linkcode Breaker} is reset.
   * @template R The type of the reason the {@linkcode Breaker} is dead.
   */
  public reset(reason: R): Wire<R> {
    this.cut(reason);
    this.current = new Wire<R>();
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
