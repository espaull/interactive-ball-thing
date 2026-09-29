// Something that happens, which any number of listeners can hear about.
export class Signal<Args extends unknown[] = []> {
  private listeners = new Set<(...args: Args) => void>();

  // Returns a function that stops listening.
  listen(listener: (...args: Args) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(...args: Args): void {
    for (const listener of this.listeners) listener(...args);
  }
}
