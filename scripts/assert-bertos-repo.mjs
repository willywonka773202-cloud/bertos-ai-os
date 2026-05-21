#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import process from 'node:process'

function run(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

try {
  const cwd = process.cwd()
  const root = run(['rev-parse', '--show-toplevel'])
  const remote = run(['remote', 'get-url', 'origin'])
  const branch = run(['branch', '--show-current'])
  const expected = 'https://github.com/willywonka773202-cloud/bertos-ai-os.git'

  if (!/bertos-ai-os/i.test(root) || !/bertos-ai-os/i.test(cwd)) {
    throw new Error(`Expected to run inside bertos-ai-os. cwd=${cwd} root=${root}`)
  }
  // Accept either the canonical GitHub URL or the cloud environment proxy URL
  // Both must reference the correct repo owner and name
  const isCanonical = remote === expected
  const isCloudProxy = /127\.0\.0\.1.*willywonka773202-cloud\/bertos-ai-os/.test(remote)
  if (!isCanonical && !isCloudProxy) {
    throw new Error(`Unexpected origin remote: ${remote}. Expected ${expected}`)
  }
  if (/sylistly/i.test(remote)) {
    throw new Error(`Blocked: origin remote references Sylistly: ${remote}`)
  }

  console.log(JSON.stringify({ ok: true, cwd, root, remote, branch }, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
