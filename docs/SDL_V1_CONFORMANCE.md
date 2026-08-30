# Shared Design Language v1 — Personal JARVIS / Portal Conformance

This repository implements Shared Design Language v1 concepts independently. It has no runtime dependency on VELYQUA Cloud or the Game Platform.

## Product boundary

The Portal is the knowledge loop inside Personal JARVIS. It may crawl, synthesize, update internal knowledge state, generate digests, and draft content autonomously. Public publishing, spending, and other consequential external actions remain policy-governed.

## Stable Spine contract

Every consequential proposed action must:
1. be represented as an Action Envelope v1;
2. be classified before execution;
3. resolve to one of AUTO, BOUNDED_AUTO, GATED, or PROHIBITED;
4. execute only through an authorized connector path;
5. record execution and verification separately;
6. produce append-oriented audit evidence with the correlation ID;
7. never let a reasoner directly mutate authority or trust state.

## Reasoning isolation

PRIME CORE / Portal reasoning returns a recommendation, proposed Action Envelope, or abstention. Reasoners do not receive connector credentials and cannot self-authorize.

## Store separation

Memory, Event Bus, and Audit Trail are distinct logical systems. Operational records are not promoted to cognitive memory unless a product-level write policy explicitly promotes them.

## Trust

Trust is action-specific evidence consumed by policy. It is not a global agent score. Trust changes only through pre-approved deterministic rules or explicit human authorization.

## Version

Implemented contract target: `SDL 1.0`.
