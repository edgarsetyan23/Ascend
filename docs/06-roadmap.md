# Ascend — Study & Growth Roadmap

## What this document covers
What to learn and build next to level up as an engineer. Ordered by priority.

---

## LeetCode

- [ ] **Arrays & Hashing** — foundation for everything else. Target: 20 problems
- [ ] **Two Pointers** — sliding window, fast/slow pointer patterns
- [ ] **Stack** — monotonic stack, parentheses, next greater element
- [ ] **Binary Search** — on sorted arrays, on answer space
- [ ] **Sliding Window** — fixed and variable width
- [ ] **Linked Lists** — reversal, cycle detection, merge
- [ ] **Trees** — DFS, BFS, lowest common ancestor
- [ ] **Graphs** — BFS/DFS, union-find, topological sort
- [ ] **Dynamic Programming** — 1D → 2D → interval DP
- [ ] **Heaps / Priority Queue** — top-K problems, merge K lists

**Target:** 300 → 400 solved. Focus on Medium. One Hard per topic once Mediums feel comfortable.

---

## System Design

- [ ] **URL Shortener** — hashing, redirect, analytics
- [ ] **Rate Limiter** — token bucket, sliding window counter
- [ ] **Key-Value Store** — consistent hashing, replication
- [ ] **Notification Service** — fan-out, queues, push vs pull
- [ ] **News Feed / Timeline** — read vs write heavy, caching strategies
- [ ] **Distributed Cache** — eviction policies, cache invalidation
- [ ] **S3 / Object Storage** — chunking, multipart upload, CDN
- [ ] **Read: "Designing Data-Intensive Applications" (Kleppmann)** — chapters 1–6 are the most interview-relevant

**For your level:** Be able to whiteboard a system with load balancer → app servers → cache → DB → async queue. Know when to use SQL vs NoSQL and why.

---

## Java / Backend Depth

- [ ] **Java Concurrency** — threads, ExecutorService, CompletableFuture, synchronized vs volatile
- [ ] **JVM internals** — heap vs stack, GC basics (G1, ZGC), when to care about GC pauses
- [ ] **Spring Boot** — dependency injection, REST controllers, service layer, JPA (even a small project)
- [ ] **SQL** — window functions, CTEs, EXPLAIN plans, indexing strategies
- [ ] **Database internals** — B-trees, WAL, MVCC (read casually, not memorize)

---

## AWS Depth (beyond what you already know)

- [ ] **SQS + SNS** — fan-out pattern, dead letter queues, visibility timeout
- [ ] **ElastiCache (Redis)** — caching patterns, TTL, pub/sub
- [ ] **RDS vs Aurora** — when to pick each, read replicas, Multi-AZ
- [ ] **Step Functions** — orchestration vs choreography
- [ ] **CloudWatch Logs Insights** — write actual queries against your own Lambda logs

---

## Behavioral / Interview Prep

- [ ] Write STAR stories for every AWS bullet on your resume
- [ ] Prepare 3 conflict/disagreement stories (on-call, code review, design decision)
- [ ] Prepare "tell me about a time you failed" — be specific, show what changed
- [ ] Practice explaining Ascend's architecture out loud in under 2 minutes
- [ ] Read about Amazon's Leadership Principles — every behavioural question maps to one

---

## Milestones

| Milestone | Goal |
|---|---|
| 350 LeetCode solved | Comfortable with all core patterns |
| 1 system design whiteboard per week | Can handle entry-level system design rounds |
| Spring Boot side project | Can speak to Java beyond AWS tooling |
| 5 STAR stories written | Behavioural round ready |
