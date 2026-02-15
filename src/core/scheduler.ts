import { Cron } from "croner";

export interface TaskRegistration {
  name: string;
  cron: string;
  handler: () => Promise<unknown> | unknown;
}

export interface ScheduledTask {
  name: string;
  cron: string;
  active: boolean;
  nextRun?: Date | null;
}

interface InternalTask {
  name: string;
  cron: string;
  handler: () => Promise<unknown> | unknown;
  job: Cron;
  active: boolean;
}

export class Scheduler {
  private tasks: Map<string, InternalTask> = new Map();

  register(reg: TaskRegistration): ScheduledTask {
    if (this.tasks.has(reg.name)) {
      throw new Error(`Task "${reg.name}" is already registered`);
    }

    const job = new Cron(reg.cron, { paused: false }, async () => {
      await reg.handler();
    });

    const task: InternalTask = {
      name: reg.name,
      cron: reg.cron,
      handler: reg.handler,
      job,
      active: true,
    };

    this.tasks.set(reg.name, task);

    return this.toScheduledTask(task);
  }

  unregister(name: string): void {
    const task = this.tasks.get(name);
    if (task) {
      task.job.stop();
      this.tasks.delete(name);
    }
  }

  listTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values()).map((t) => this.toScheduledTask(t));
  }

  getTask(name: string): ScheduledTask | undefined {
    const task = this.tasks.get(name);
    return task ? this.toScheduledTask(task) : undefined;
  }

  pause(name: string): void {
    const task = this.tasks.get(name);
    if (task) {
      task.job.pause();
      task.active = false;
    }
  }

  resume(name: string): void {
    const task = this.tasks.get(name);
    if (task) {
      task.job.resume();
      task.active = true;
    }
  }

  async runNow(name: string): Promise<unknown> {
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`Task "${name}" not found`);
    }
    return await task.handler();
  }

  stopAll(): void {
    for (const task of this.tasks.values()) {
      task.job.stop();
    }
    this.tasks.clear();
  }

  private toScheduledTask(task: InternalTask): ScheduledTask {
    return {
      name: task.name,
      cron: task.cron,
      active: task.active,
      nextRun: task.job.nextRun(),
    };
  }
}
