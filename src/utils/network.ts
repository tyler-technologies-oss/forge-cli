import * as net from 'net';

export const ERROR_NETWORK_ADDRESS_NOT_AVAIL = 'NETWORK_ADDRESS_NOT_AVAIL';

/**
 * Finds the closes open port to the requested port by incrementing until found.
 * @param port The starting port.
 * @param host The optional hostname to check.
 */
export async function findClosestOpenPort(port: number, host?: string): Promise<number> {
  async function t(portToCheck: number): Promise<number> {
    if (await isPortAvailable(portToCheck, host)) {
      return portToCheck;
    }
    return t(portToCheck + 1);
  }
  return t(port);
}

/**
 * Determines if a specific port is available for usage.
 * @param port The port to test.
 * @param host The hostname to test for the port.
 */
export async function isPortAvailable(port: number, host?: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const tester = net.createServer()
      .once('error', (err: any) => {
        if (err.code === 'EADDRNOTAVAIL') {
          reject(ERROR_NETWORK_ADDRESS_NOT_AVAIL);
        } else if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          reject(err);
        }
      })
      .once('listening', () => {
        tester
          .once('close', () => resolve(true))
          .close();
      })
      .listen(port, host);
  });
}
