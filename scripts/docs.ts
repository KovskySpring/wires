const cmd = new Deno.Command("deno", {
  args: ["doc", "--html", "--name=wires", "src/mod.ts"],
  stdout: "inherit",
  stderr: "inherit",
});

await cmd.output();
