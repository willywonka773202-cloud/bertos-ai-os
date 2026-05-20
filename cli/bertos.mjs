#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline/promises'
import process from 'node:process'

const CONFIG_DIR = path.join(os.homedir(), '.bertos')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

async function readConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_FILE, 'utf8'))
  } catch {
    return {}
  }
}

async function writeConfig(config) {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

async function promptInit() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const current = await readConfig()
  const apiUrl = await rl.question(`BertOS API URL [${current.apiUrl || 'http://localhost:3000'}]: `)
  const secret = await rl.question('BertOS agent secret: ')
  const defaultProvider = await rl.question(`Default provider [${current.defaultProvider || 'ollama-pro'}]: `)
  rl.close()

  const config = {
    apiUrl: (apiUrl || current.apiUrl || 'http://localhost:3000').replace(/\/+$/, ''),
    agentSecret: secret || current.agentSecret || '',
    defaultProvider: defaultProvider || current.defaultProvider || 'ollama-pro',
  }
  await writeConfig(config)
  console.log(`Saved BertOS CLI config to ${CONFIG_FILE}`)
}

function usage() {
  console.log(`BertOS CLI

Commands:
  bertos init
  bertos status
  bertos providers
  bertos ask "message"
  bertos chat
  bertos doctor
  bertos daemon
`)
}

async function apiFetch(pathname, options = {}) {
  const config = await readConfig()
  if (!config.apiUrl) {
    throw new Error('BertOS CLI is not initialized. Run: bertos init')
  }
  if (!config.agentSecret && pathname.startsWith('/api/cli/')) {
    throw new Error('BertOS agent secret is missing. Run: bertos init')
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (config.agentSecret) headers.Authorization = `Bearer ${config.agentSecret}`

  const res = await fetch(`${config.apiUrl}${pathname}`, {
    ...options,
    headers,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data
}

async function status() {
  const data = await apiFetch('/api/cli/status')
  console.log(JSON.stringify(data, null, 2))
}

async function providers() {
  const data = await apiFetch('/api/providers/status')
  console.log(JSON.stringify(data, null, 2))
}

async function ask(message) {
  if (!message) throw new Error('Usage: bertos ask "message"')
  const config = await readConfig()
  const data = await apiFetch('/api/cli/ask', {
    method: 'POST',
    body: JSON.stringify({
      prompt: message,
      providerId: config.defaultProvider || 'ollama-pro',
    }),
  })
  console.log(data.text || JSON.stringify(data, null, 2))
}

async function chat() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  console.log('BertOS chat. Type /exit to quit.')
  while (true) {
    const line = await rl.question('> ')
    if (line.trim() === '/exit') break
    if (!line.trim()) continue
    try {
      await ask(line)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
    }
  }
  rl.close()
}

async function doctor() {
  const config = await readConfig()
  console.log(`Config file: ${CONFIG_FILE}`)
  console.log(`API URL: ${config.apiUrl || 'missing'}`)
  console.log(`Agent secret: ${config.agentSecret ? 'set' : 'missing'}`)
  console.log(`Default provider: ${config.defaultProvider || 'ollama-pro'}`)
  try {
    await status()
  } catch (error) {
    console.error(`Status failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    await providers()
  } catch (error) {
    console.error(`Provider status failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function daemon() {
  const script = path.resolve(process.cwd(), 'scripts', 'bertos-daemon.mjs')
  const child = spawn(process.execPath, [script], {
    stdio: 'inherit',
    env: process.env,
    windowsHide: false,
  })
  child.on('exit', code => process.exit(code ?? 0))
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  try {
    switch (command) {
      case 'init':
        await promptInit()
        break
      case 'status':
        await status()
        break
      case 'providers':
        await providers()
        break
      case 'ask':
        await ask(args.join(' '))
        break
      case 'chat':
        await chat()
        break
      case 'doctor':
        await doctor()
        break
      case 'daemon':
        daemon()
        break
      default:
        usage()
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

main()
