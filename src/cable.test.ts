import { wrap } from "./cable.ts";
import { Breaker, breaker, Wire } from "./wire.ts";

function started(...args: unknown[]) {
  console.log("Started with args:", ...args);
}

function completed(...args: unknown[]) {
  console.log("Completed with args:", ...args);
}

function actionA(input: number): string {
  started(input);
  completed(input);
  return `Number: ${input}`;
}

function actionB(input: string): Promise<boolean> {
  return new Promise((resolve) => {
    started(input);
    setTimeout(() => {
      completed(input);
      resolve(input.length > 10);
    }, 1000);
  });
}

function actionC(input: boolean): Promise<number> {
  return new Promise((resolve) => {
    started(input);
    setTimeout(() => {
      completed(input);
      resolve(input ? 1 : 0);
    }, 5000);
  });
}

async function spammable(controller: Breaker, input: number) {
  const wire = controller.reset();

  const output = await wrap(wire, input)
    .map(actionA)
    .asyncify()
    .map(actionB)
    .map(actionC)
    .unwrap(2);

  return output;
}

async function main() {
  const controller = breaker();

  setTimeout(() => controller.cut(), 2000); // Cut the wire after 2 seconds

  spammable(controller, Math.random());
  spammable(controller, Math.random());
  const outcome = await spammable(controller, Math.random());
  console.log(outcome);
}

await main();
