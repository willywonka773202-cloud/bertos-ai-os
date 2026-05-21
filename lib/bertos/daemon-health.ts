export interface DaemonHealth {
  ok: boolean
  daemonOnline: boolean
  daemonUrl?: string
  version?: string
  uptimeMs?: number
  workspaceRoot?: string
  repoDetected?: boolean
  gitDetected?: boolean
  packageJsonDetected?: boolean
  scripts?: {
    typecheck?: boolean
    build?: boolean
    lint?: boolean
    test?: boolean
    bertosDaemon?: boolean
  }
  capabilities: {
    readFiles: boolean
    runSafeCommands: boolean
    gitStatus: boolean
    gitDiff: boolean
    askProvider: boolean
  }
  error?: string
  fixCommand?: string
}

export const DAEMON_START_COMMAND = 'npm run bertos:daemon'

export function offlineDaemonHealth(error = 'Local daemon is not running.'): DaemonHealth {
  return {
    ok: false,
    daemonOnline: false,
    capabilities: {
      readFiles: false,
      runSafeCommands: false,
      gitStatus: false,
      gitDiff: false,
      askProvider: false,
    },
    error,
    fixCommand: DAEMON_START_COMMAND,
  }
}
