import * as net from 'net';
import { Notice } from 'obsidian';
import { EventEmitter } from 'events';

export class TcpTransport extends EventEmitter {
    private server: net.Server | null = null;
    private port: number = 0;
    private connections: Map<string, net.Socket> = new Map(); // peerId -> Socket
    private myPeerId: string = '';

    constructor() {
        super();
    }

    setIdentity(peerId: string) {
        this.myPeerId = peerId;
    }

    async initialize(): Promise<number> {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                this.handleConnection(socket);
            });

            this.server.listen(0, () => { // 0 means random available port
                const address = this.server?.address();
                if (address && typeof address !== 'string') {
                    this.port = address.port;
                    console.log(`TCP Transport listening on port ${this.port}`);
                    resolve(this.port);
                } else {
                    reject(new Error('Failed to get server port'));
                }
            });

            this.server.on('error', (err) => {
                console.error('TCP Server error:', err);
                reject(err);
            });
        });
    }

    getPort(): number {
        return this.port;
    }

    connectToPeer(peerId: string, ip: string, port: number): void {
        if (this.connections.has(peerId)) {
            return; // Already connected
        }

        console.log(`Connecting to peer ${peerId} at ${ip}:${port}`);
        const socket = net.createConnection({ host: ip, port: port }, () => {
            console.log(`Connected to ${peerId}`);
            this.connections.set(peerId, socket);
            this.setupSocket(socket, peerId);

            // Send Handshake
            this.sendHandshake(socket);

            // Wait a brief moment for the socket to be fully ready before emitting
            setTimeout(() => {
                this.emit('connected', peerId);
            }, 100);
        });

        socket.on('error', (err) => {
            console.error(`Connection error with ${peerId}:`, err);
            this.connections.delete(peerId);
        });
    }

    private sendHandshake(socket: net.Socket) {
        if (!this.myPeerId) {
            console.warn('Cannot send handshake: Identity not set');
            return;
        }
        const handshake = {
            type: 'HANDSHAKE',
            peerId: this.myPeerId
        };
        this.sendToSocket(socket, handshake);
    }

    send(peerId: string, data: any): void {
        const socket = this.connections.get(peerId);
        if (socket) {
            this.sendToSocket(socket, data);
        } else {
            console.warn(`Cannot send to ${peerId}: not connected`);
        }
    }

    private sendToSocket(socket: net.Socket, data: any) {
        const json = JSON.stringify(data);
        const buffer = Buffer.from(json, 'utf-8');
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeUInt32BE(buffer.length, 0);

        socket.write(lengthBuffer);
        socket.write(buffer);
    }

    disconnect(peerId: string): void {
        const socket = this.connections.get(peerId);
        if (socket) {
            socket.end();
            socket.destroy();
            this.connections.delete(peerId);
            console.log(`Disconnected from ${peerId}`);
            this.emit('disconnected', peerId);
        }
    }

    disconnectAll(): void {
        for (const peerId of this.connections.keys()) {
            this.disconnect(peerId);
        }
    }

    isConnected(peerId: string): boolean {
        return this.connections.has(peerId);
    }

    private handleConnection(socket: net.Socket) {
        console.log('Incoming connection from', socket.remoteAddress);
        // We don't know the peerId yet. Wait for handshake.
        this.setupSocket(socket);

        // Send our handshake immediately on incoming connection too
        this.sendHandshake(socket);
    }

    private setupSocket(socket: net.Socket, peerId?: string) {
        let buffer = Buffer.alloc(0);
        let expectedLength: number | null = null;

        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);

            while (true) {
                if (expectedLength === null) {
                    if (buffer.length >= 4) {
                        expectedLength = buffer.readUInt32BE(0);
                        buffer = buffer.slice(4);
                    } else {
                        break; // Wait for more data
                    }
                }

                if (expectedLength !== null) {
                    if (buffer.length >= expectedLength) {
                        const messageBuffer = buffer.slice(0, expectedLength);
                        buffer = buffer.slice(expectedLength);
                        expectedLength = null;

                        try {
                            const messageStr = messageBuffer.toString('utf-8');
                            const message = JSON.parse(messageStr);
                            this.handleMessage(socket, message, peerId);
                        } catch (e) {
                            console.error('Failed to parse message:', e);
                        }
                    } else {
                        break; // Wait for more data
                    }
                }
            }
        });

        socket.on('close', () => {
            // If we have a mapped peerId for this socket, use it
            // We need to find which peerId this socket belongs to if peerId arg is undefined
            let disconnectedPeerId = peerId;

            if (!disconnectedPeerId) {
                for (const [id, s] of this.connections.entries()) {
                    if (s === socket) {
                        disconnectedPeerId = id;
                        break;
                    }
                }
            }

            if (disconnectedPeerId) {
                console.log(`Connection closed with ${disconnectedPeerId}`);
                this.connections.delete(disconnectedPeerId);
                this.emit('disconnected', disconnectedPeerId);
            }
        });
    }

    private handleMessage(socket: net.Socket, message: any, knownPeerId?: string) {
        if (message.type === 'HANDSHAKE') {
            const remotePeerId = message.peerId;
            console.log(`Received handshake from ${remotePeerId}`);

            // Store connection
            this.connections.set(remotePeerId, socket);

            // Emit connected event for incoming connections
            // Only emit if we didn't already know the peer (i.e. it's an incoming connection)
            if (!knownPeerId) {
                this.emit('connected', remotePeerId);
            }
        } else {
            // If we don't know the peerId yet, try to find it in our map
            let senderId = knownPeerId;
            if (!senderId) {
                for (const [id, s] of this.connections.entries()) {
                    if (s === socket) {
                        senderId = id;
                        break;
                    }
                }
            }

            if (senderId) {
                this.emit('message', message, senderId);
            } else {
                console.warn('Received message from unknown socket');
            }
        }
    }

    broadcast(data: any) {
        for (const peerId of this.connections.keys()) {
            this.send(peerId, data);
        }
    }
}
