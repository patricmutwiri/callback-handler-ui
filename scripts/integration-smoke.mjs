/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const HOST = '127.0.0.1'
const PORT = 3100
const BASE_URL = `http://${HOST}:${PORT}`
const SLUG = `integration-${Date.now()}-${randomUUID().slice(0, 8)}`
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function createError(message, details = '') {
  const error = new Error(details ? `${message}\n${details}` : message)
  error.details = details
  return error
}

function runCommand(command, args, label, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      reject(createError(`${label} failed to start.`, error.message))
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      reject(
        createError(
          `${label} failed with exit code ${code}.`,
          [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
        )
      )
    })
  })
}

async function fetchWithExpectation(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options)
  const text = await response.text()
  let json = null

  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  return { response, text, json }
}

function extractCookie(response) {
  const rawCookie = response.headers.get('set-cookie') || ''
  const slugCookie = rawCookie
    .split(',')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`slug_creator_${SLUG}=`))

  return slugCookie ? slugCookie.split(';')[0] : ''
}

async function waitForServer(serverProcess) {
  const maxAttempts = 60

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw createError('App server exited before becoming ready.')
    }

    try {
      const response = await fetch(`${BASE_URL}/`, {
        headers: { Accept: 'text/html' },
      })

      if (response.ok) {
        return
      }
    } catch {
      await delay(500)
      continue
    }
  }

  throw createError('Timed out waiting for the app server to become ready.')
}

async function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return
  }

  serverProcess.kill('SIGINT')

  await Promise.race([
    new Promise((resolve) => serverProcess.once('close', resolve)),
    delay(5000).then(() => {
      if (serverProcess.exitCode === null) {
        serverProcess.kill('SIGKILL')
      }
    }),
  ])
}

function assert(condition, message, details = '') {
  if (!condition) {
    throw createError(message, details)
  }
}

async function pollForCapturedRequest() {
  const slugCookie = `slug_creator_${SLUG}=1`
  const maxAttempts = 15

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { response, json, text } = await fetchWithExpectation(`/api/record/${SLUG}`, {
      headers: {
        Cookie: slugCookie,
      },
    })

    assert(response.ok, 'Failed to read recorded requests.', text)

    if (
      Array.isArray(json?.requests) &&
      json.requests.some((entry) => entry?.body?.event === 'integration-smoke')
    ) {
      return json
    }

    await delay(500)
  }

  throw createError('Timed out waiting for the webhook request to appear in the record API.')
}

async function main() {
  let serverProcess = null

  try {
    console.log('1. Building the app...')
    await runCommand(npmCommand, ['run', 'build'], 'Production build')

    console.log('2. Starting the app server...')
    serverProcess = spawn(
      npmCommand,
      ['run', 'start', '--', '--hostname', HOST, '--port', String(PORT)],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )

    let serverLogs = ''
    serverProcess.stdout.on('data', (chunk) => {
      serverLogs += chunk.toString()
    })
    serverProcess.stderr.on('data', (chunk) => {
      serverLogs += chunk.toString()
    })
    serverProcess.on('error', (error) => {
      throw createError('App server failed to start.', error.message)
    })

    await waitForServer(serverProcess)

    console.log('3. Verifying the home page...')
    const home = await fetchWithExpectation('/', {
      headers: { Accept: 'text/html' },
    })
    assert(home.response.ok, 'Home page did not return HTTP 200.', home.text)
    assert(home.text.includes('Callback Handler'), 'Home page is missing expected content.')

    console.log('4. Initializing a record page slug...')
    const recordPage = await fetchWithExpectation(`/record/${SLUG}`, {
      headers: { Accept: 'text/html' },
    })
    assert(recordPage.response.ok, 'Record page did not initialize successfully.', recordPage.text)
    assert(recordPage.text.includes(SLUG), 'Record page response did not include the initialized slug.')
    const slugCookie = extractCookie(recordPage.response)
    assert(
      slugCookie.startsWith(`slug_creator_${SLUG}=`),
      'Guest record page did not issue the slug ownership cookie.',
      recordPage.response.headers.get('set-cookie') || ''
    )

    console.log('5. Confirming unauthorized config access is blocked...')
    const deniedConfig = await fetchWithExpectation(`/api/config/${SLUG}`, {
      headers: { Accept: 'application/json' },
    })
    assert(
      deniedConfig.response.status === 403,
      'Config endpoint should reject requests without ownership proof.',
      deniedConfig.text
    )

    console.log('6. Saving a custom response config with the slug cookie...')
    const configPayload = {
      status: 202,
      body: JSON.stringify({ accepted: true }),
      contentType: 'application/json',
    }

    const savedConfig = await fetchWithExpectation(`/api/config/${SLUG}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: slugCookie,
      },
      body: JSON.stringify(configPayload),
    })
    assert(savedConfig.response.ok, 'Failed to save custom config.', savedConfig.text)
    assert(savedConfig.json?.config?.status === 202, 'Saved config did not preserve the expected status.', savedConfig.text)

    console.log('7. Posting webhook payloads...')
    for (let index = 0; index < 6; index += 1) {
      const webhookResponse = await fetchWithExpectation(`/record/${SLUG}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'integration-smoke',
          ok: true,
          index,
        }),
      })
      assert(webhookResponse.response.status === 202, 'Webhook request did not return the configured 202 status.', webhookResponse.text)
      assert(webhookResponse.json?.accepted === true, 'Webhook response body did not match the configured payload.', webhookResponse.text)
    }

    console.log('8. Verifying the webhook was persisted...')
    const capturedRequests = await pollForCapturedRequest()
    assert(capturedRequests.requests.length === 5, 'Guest record API should expose only the 5 most recent requests.')
    assert(capturedRequests.requiresLogin === true, 'Guest record API should require login when more than 5 requests exist.')
    assert(capturedRequests.guestVisibleLimit === 5, 'Guest record API should report the configured guest visibility limit.')

    console.log('9. Verifying authorized config reads still work...')
    const authorizedConfig = await fetchWithExpectation(`/api/config/${SLUG}`, {
      headers: {
        Cookie: slugCookie,
      },
    })
    assert(authorizedConfig.response.ok, 'Authorized config read failed.', authorizedConfig.text)
    assert(authorizedConfig.json?.status === 202, 'Authorized config read returned the wrong status.', authorizedConfig.text)

    console.log('Integration smoke test passed.')
  } finally {
    await stopServer(serverProcess)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
