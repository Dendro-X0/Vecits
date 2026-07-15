import net from "node:net";

export function isValidDevPort(port) {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}

export function canBind(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

export async function pickRandomPort(min, max) {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const port = min + Math.floor(Math.random() * (max - min + 1));
    if (await canBind(port)) {
      return port;
    }
  }
  throw new Error(`Could not find a free port in ${min}–${max}`);
}
