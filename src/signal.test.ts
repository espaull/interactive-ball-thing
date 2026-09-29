import { describe, expect, it } from "vitest";
import { Signal } from "./signal";

describe("signals", () => {
  it("tell every listener, until they stop listening", () => {
    const signal = new Signal<[number]>();
    const heard: string[] = [];
    const stop = signal.listen((n) => heard.push(`a${n}`));
    signal.listen((n) => heard.push(`b${n}`));
    signal.emit(1);
    stop();
    signal.emit(2);
    expect(heard).toEqual(["a1", "b1", "b2"]);
  });
});
