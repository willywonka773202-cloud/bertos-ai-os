#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

  if (pkg.name !== 'bertos-ai-os') {
    throw new Error(`Expected bertos-ai-os package. cwd=${cwd} root=${root} package=${pkg.name}`)
  }
  if (remote !== expected) {
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
