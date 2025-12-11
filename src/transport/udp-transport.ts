import * as dgram from 'dgram';
import { EventEmitter } from 'events';

export class UdpTransport extends EventEmitter {
    private socket: dgram.Socket | null = null;
    private port: number = 19840;
    private broadcastAddress: string = '255.255.255.255';

    constructor(port: number = 19840) {
        super();
        this.port = port;
    }

    start(): void {
        try {
            this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

            this.socket.on('error', (err) => {
                console.error(`UDP Transport error:\n${err.stack}`);
                this.emit('error', err);
            });

            this.socket.on('message', (msg, rinfo) => {
                this.emit('message', msg.toString(), rinfo.address);
            });

            this.socket.on('listening', () => {
                const address = this.socket?.address();
                console.log(`UDP Transport listening ${address?.address}:${address?.port}`);
                try {
                    this.socket?.setBroadcast(true);
                } catch (e) {
                    console.warn('Failed to set broadcast:', e);
                }
            });

            this.socket.bind(this.port);
        } catch (e) {
            console.error('Failed to create UDP socket:', e);
            this.emit('error', e);
        }
    }

    broadcast(message: string): void {
        if (!this.socket) return;
        const buffer = Buffer.from(message);
        this.socket.send(buffer, 0, buffer.length, this.port, this.broadcastAddress, (err) => {
            if (err) console.error('Broadcast error:', err);
        });
    }

    stop(): void {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}
