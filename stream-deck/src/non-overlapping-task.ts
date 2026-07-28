export class NonOverlappingTask {
  private running?: Promise<void>;

  run(task: () => Promise<void>): Promise<void> {
    if (this.running) return this.running;
    this.running = Promise.resolve()
      .then(task)
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
}
