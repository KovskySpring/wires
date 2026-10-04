import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import { breaker, type ReadonlyWire, wire } from "./wire.ts";

Deno.test("unsubscribing during a cut stops a listener that has not run", () => {
  const cut = wire();
  const calls: string[] = [];
  cut.once(() => {
    calls.push("first");
    unsubscribe();
  });
  const unsubscribe = cut.once(() => calls.push("second"));

  cut.cut();

  assertEquals(calls, ["first"]);
});

Deno.test("connect accepts a ReadonlyWire parent", () => {
  const controller = breaker();
  const parent: ReadonlyWire = controller.wire;
  const child = wire();
  child.connect(parent);

  controller.cut();

  assert(child.isDead());
});

Deno.test("ReadonlyWire hides cut from the type only", () => {
  const readonly: ReadonlyWire = wire();

  // @ts-expect-error `cut` is not part of `ReadonlyWire`
  assertEquals(typeof readonly.cut, "function");
});

Deno.test("cut reports listener errors and runs the remaining listeners", () => {
  const reported: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    event.preventDefault();
    reported.push(event.error);
  };
  globalThis.addEventListener("error", onError);

  try {
    const controller = breaker();
    const first = controller.wire;
    const child = wire();
    const error = new Error("listener threw");
    first.once(() => {
      throw error;
    });
    child.connect(first);

    const next = controller.reset();

    assert(first.isDead());
    assert(child.isDead());
    assert(next.isLive());
    assertStrictEquals(controller.wire, next);
    assertEquals(reported, [error]);
  } finally {
    globalThis.removeEventListener("error", onError);
  }
});
