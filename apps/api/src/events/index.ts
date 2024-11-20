interface AIEvents {
  aiUsage: (
    type: 'sql' | 'python',
    action: 'edit' | 'fix',
    modelId: string | null
  ) => void
}

export interface PythonEvents extends AIEvents {
  pythonRun: () => void
}

export interface SQLEvents extends AIEvents {
  sqlRun: () => void
}

export interface VisEvents {
  visUpdate: (chartType: string) => void
}

export interface WritebackEvents extends AIEvents {
  writeback: () => void
}

export interface NotebookBlockEvents {
  blockAdd: (blockType: string) => void
}
export interface NotebookEvents
  extends PythonEvents,
    SQLEvents,
    VisEvents,
    WritebackEvents,
    NotebookBlockEvents {}
