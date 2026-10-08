import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { LiveService } from './live.service';
import type { LiveIdentity } from './live.types';

function room(sessionId: string): string {
  return `session:${sessionId}`;
}

@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class LiveGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(LiveGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly liveService: LiveService) {}

  afterInit(server: Server): void {
    this.liveService.attach({
      state: (sessionId, snapshot) => {
        server.to(room(sessionId)).emit('live:state', snapshot);
        void this.sendBallots(server, sessionId);
      },
      votes: (sessionId, voteCount) => {
        server.to(room(sessionId)).emit('live:votes', { voteCount });
      },
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const identity = await this.liveService.authenticate(
        client.handshake.auth as Record<string, unknown>,
      );
      (client.data as { identity?: LiveIdentity }).identity = identity;
      await client.join(room(identity.sessionId));
      client.emit('live:state', await this.liveService.snapshot(identity.sessionId));
      if (identity.role === 'participant' && identity.participantId) {
        client.emit(
          'live:ballot',
          await this.liveService.myBallot(identity.participantId, identity.sessionId),
        );
        await this.liveService.touch(identity.participantId);
      }
    } catch {
      client.emit('live:error', { message: 'The live connection was refused.' });
      client.disconnect(true);
    }
  }

  private async sendBallots(server: Server, sessionId: string): Promise<void> {
    const sockets = await server.in(room(sessionId)).fetchSockets();
    await Promise.all(
      sockets.map(async (socket) => {
        const identity = (socket.data as { identity?: LiveIdentity }).identity;
        if (identity?.role !== 'participant' || !identity.participantId) {
          return;
        }
        socket.emit(
          'live:ballot',
          await this.liveService.myBallot(identity.participantId, identity.sessionId),
        );
      }),
    );
  }

  handleDisconnect(client: Socket): void {
    const identity = (client.data as { identity?: LiveIdentity }).identity;
    if (identity) {
      this.logger.debug(`Live client left session ${identity.sessionId}`);
    }
  }
}
