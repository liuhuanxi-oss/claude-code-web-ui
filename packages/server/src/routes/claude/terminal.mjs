import { WebSocketServer } from 'ws'
import { spawn } from 'node-pty'
import { Server } from 'http'

export function setupTerminalWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws/claude/terminal' })

  wss.on('connection', (ws, req) => {
    const shell = process.env.SHELL || '/bin/zsh'
    const cwd = process.env.HOME || '/root'

    let ptyProcess
    try {
      ptyProcess = spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env: { ...process.env, TERM: 'xterm-256color' },
      })
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: `Failed to spawn terminal: ${e.message}` }))
      ws.close()
      return
    }

    ptyProcess.onData((data) => {
      try { ws.send(JSON.stringify({ type: 'output', data })) } catch { /* ws closed */ }
    })

    ptyProcess.onExit(({ exitCode }) => {
      try { ws.send(JSON.stringify({ type: 'exit', exitCode })) } catch { /* ws closed */ }
      ws.close()
    })

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString())
        if (data.type === 'input' && ptyProcess) {
          ptyProcess.write(data.data)
        } else if (data.type === 'resize' && ptyProcess) {
          ptyProcess.resize(data.cols || 80, data.rows || 24)
        }
      } catch { /* ignore invalid messages */ }
    })

    ws.on('close', () => {
      if (ptyProcess) {
        try { ptyProcess.kill() } catch { /* already dead */ }
      }
    })
  })
}
