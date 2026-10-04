import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import { breaker, wire } from "./wire.ts";

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
