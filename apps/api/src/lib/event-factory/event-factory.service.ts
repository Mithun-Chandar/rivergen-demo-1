import { randomUUID } from "node:crypto";

import { eventBus } from "../event-bus.service";
import { trace } from "../river-trace";
import {
  EventEnvelopeSchema,
  EventPayloadSchemas,
  type EventActor,
  type EventContext,
  type EventEnvelope,
  type EventOrigin,
} from "./schemas/_index";

export type PublishInput<TPayload> = {
  type: string;
  resourceId: string;
  actor: EventActor;
  context: EventContext;
  correlationId: string;
  payload: TPayload;
  eventVersion: string;
};

function buildOrigin(): EventOrigin {
  return {
    service: process.env.SERVICE_NAME ?? "api",
    instanceId: process.env.HOSTNAME ?? "local-dev",
  };
}

export class EventFactory {
  private async publishValidatedEnvelope(
    envelope: EventEnvelope,
  ): Promise<void> {
    await eventBus.publishEnvelope(envelope);
  }

  async publish<TPayload>(input: PublishInput<TPayload>): Promise<void> {
    const payloadSchema = EventPayloadSchemas[input.type];
    if (!payloadSchema) {
      throw new Error(
        `NON-COMPLIANT/BLOCKED: No payload schema registered for event type "${input.type}". Add a .strict() Zod schema entry to the domain slice in apps/api/src/lib/event-factory/schemas/<domain>.ts`,
      );
    }

    const parsedPayload = payloadSchema.parse(input.payload) as TPayload;

    trace({
      stage: "publish",
      domain: input.type.split(".")[0] ?? "unknown",
      eventName: input.type,
      correlationId: input.correlationId,
      session: input.actor.id,
      payload: parsedPayload as Record<string, unknown>,
      status: "ok",
      detail: "payload validated against domain schema",
    });

    const envelope: EventEnvelope = {
      id: randomUUID(),
      type: input.type,
      envelopeVersion: "1.0",
      eventVersion: input.eventVersion,
      timestamp: Date.now(),
      resourceId: input.resourceId,
      actor: input.actor,
      context: input.context,
      payload: parsedPayload as unknown,
      correlationId: input.correlationId,
      origin: buildOrigin(),
    };

    EventEnvelopeSchema.parse(envelope);
    await this.publishValidatedEnvelope(envelope);
  }

  validate<TPayload>(input: PublishInput<TPayload>): EventEnvelope {
    const payloadSchema = EventPayloadSchemas[input.type];
    if (!payloadSchema) {
      throw new Error(
        `NON-COMPLIANT/BLOCKED: No payload schema registered for event type "${input.type}"`,
      );
    }

    const parsedPayload = payloadSchema.parse(input.payload) as TPayload;

    return EventEnvelopeSchema.parse({
      id: randomUUID(),
      type: input.type,
      envelopeVersion: "1.0",
      eventVersion: input.eventVersion,
      timestamp: Date.now(),
      resourceId: input.resourceId,
      actor: input.actor,
      context: input.context,
      payload: parsedPayload as unknown,
      correlationId: input.correlationId,
      origin: buildOrigin(),
    });
  }
}

export const eventFactory = new EventFactory();
