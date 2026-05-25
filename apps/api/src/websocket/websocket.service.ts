export interface SocketRoomEmitterLike {
  emit(eventName: string, payload: unknown): void;
}

export interface SocketServerLike {
  to(room: string): SocketRoomEmitterLike;
}
