import { NotebookEvents } from './index.js'

export class ScheduleNotebookEvents implements NotebookEvents {
  public constructor() {}

  public pythonRun() {}

  public sqlRun() {}

  public aiUsage() {}

  public visUpdate() {}

  public writeback() {}

  public blockAdd() {}
}
