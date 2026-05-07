import { WebSocketServer } from 'ws';
import chalk from 'chalk';

let wss = null;

export function initWebSocketServer(port = 4040) {
  wss = new WebSocketServer({ port });
  
  wss.on('connection', (ws) => {
    console.log(chalk.blue(`[WS] PayloadX Desktop App Connected.`));
    ws.on('message', (message) => {
      console.log(chalk.gray(`[WS] Received: ${message}`));
    });
  });

  console.log(chalk.green(`[WS] WebSocket server started on ws://localhost:${port}`));
}

export function broadcastDiff(diffResult) {
  if (!wss) return;

  const payload = JSON.stringify({
    type: 'SYNC_ROUTES',
    data: diffResult
  });

  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}
