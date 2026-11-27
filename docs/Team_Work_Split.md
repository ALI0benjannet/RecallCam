# RecallCam team work split

Version 1.0 | 27 November 2026 | Team coordination

This is the team's working allocation of the remaining processing and retrieval work. It supplements the cahier des charges. Owners carry their features from contracts and persistence through integration, user interface where applicable, evaluation and documentation. Mohamed Elgheith coordinates architecture and integration.

## Team and starting point

| Team member | Primary ownership |
| --- | --- |
| Mohamed Elgheith | Architecture, processing jobs, worker orchestration, VLM integration, deployment and final integration. |
| Ali | Camera lines/zones, detection, tracking, attributes, events and activity selection. |
| Gheith Mahmoud | Video preparation, camera-days, embeddings, indexes and baseline temporal grounding. |
| Boutheina | Query planning, hybrid retrieval, ranking, trained temporal grounding and retrieval evaluation. |
| Ons | Summaries, answering agent, evidence experience, query application features and SurvQA coordination. |

As of this allocation, the repository contains authentication, roles, administration, camera metadata, uploads/library/playback, explicit playback preparation and opt-in retention. The AI stages, production indexing-job orchestration and online retrieval remain unimplemented. This is a planning snapshot; agents must inspect the current checkout before reporting readiness.

Use the same CITIC-MTMC release for shared development. Each fixed viewpoint has one camera record, reused across recording sessions. CITIC supports initial development and demos. The specified UCA/UCF-Crime camera-days, QVHighlights/Charades-STA evaluation and SurvQA requirements still apply.

## How agents select work

At the start of a new chat, ask which team member is working if their identity is unknown. Use the canonical names above. An answer such as "Gheith" needs clarification between Mohamed Elgheith and Gheith Mahmoud. Use an identity already explicitly established in the current chat without asking again.

Read this guide, inspect relevant code/contracts/migrations and report a concrete next task with its ID, deliverable and dependencies. Classify readiness as one of the following.

- **Start now** means the task's required inputs exist and are usable for its stated scope.
- **Start with fixtures** means implementation can proceed against an agreed interface and clearly labelled sample outputs; live integration awaits upstream work.
- **Waiting for dependency** means a named prerequisite prevents that step. State the missing task/output and its owner, then identify independent work that can proceed.

A scaffold, placeholder, fixture or healthy media worker does not establish live indexing readiness. Assignment establishes default ownership; an explicit request from the user can authorize another task. Record agreed ownership/dependency changes in this guide and regenerate the PDF when this guide changes.

<!-- pdf-page-break -->

## 1. Processing

Processing covers an explicit Process request through publication of a searchable index. An upload first remains in the recording library. PostgreSQL owns durable job/progress/output records; Redis carries small job references. All background and periodic work belongs to the worker.

### Foundations and perception

| ID | Owner | Work and handoff |
| --- | --- | --- |
| P01 | Mohamed Elgheith | Define versioned processing contracts, IDs, absolute/relative timestamps, storage references and stage handoffs. Coordinate schema changes with each producer and consumer. Deliver fixtures and validated schemas. |
| P02 | Mohamed Elgheith | Implement explicit Process, job/stage/attempt persistence, durable outbox, Redis dispatch, queue/status APIs and UI. Prevent duplicate active jobs for a video. |
| P03 | Mohamed Elgheith | Implement sequential orchestration, a shared claim allowing one active indexing job, checkpoints, retries, recovery and truthful stage progress. Preserve idempotency across interruptions. |
| P04 | Mohamed Elgheith | Maintain Docker, portable environment settings, inference endpoints, storage integration, processing-service health and CI configuration. Integrate dependencies without machine-specific application branches. |
| P05 | Gheith Mahmoud | Maintain shared footage manifests, licences and source-to-timeline mappings. Build reproducible UCA/UCF-Crime camera-days with re-timed annotations; preserve camera/viewpoint identity and documented simulated timelines. |
| P06 | Gheith Mahmoud | Decode and validate originals with FFmpeg/FFprobe. Produce provisional chunks, frame references and consistent timestamps in bounded batches. Finalize chunk boundaries with P09 before dependent indexing. |
| P07 | Ali | Implement the camera line/zone editor, API and versioned configuration storage. Use normalized coordinates, direction-aware entry lines and a reference frame. Jobs retain the effective camera configuration version. |
| P08 | Ali | Detect and track people, vehicles and carried objects; extract colours and associations. Preserve track continuity across batches and avoid duplicate observations from chunk overlaps. |
| P09 | Ali | Persist entry/exit, zone, stop and dwell events. Select VLM inputs from activity/change, then remove redundant views. Preserve static coverage, meaningful changes and detector-miss fallback checks. Hand off final chunk/frame selection with P06. |

The processing models run one stage at a time across the current video. CV starts at 5 FPS. Sampling, resolution and bounded batch size remain configurable. A candidate keyframe rate does not determine the VLM request rate.

<!-- pdf-page-break -->

### Embeddings, captions and publication

| ID | Owner | Work and handoff |
| --- | --- | --- |
| P10 | Gheith Mahmoud | Generate visual embeddings of retained keyframes and pool by chunk. Version models/settings and maintain a compatible text-query encoder. Own the specified embedding comparison/adaptation work. |
| P11 | Mohamed Elgheith | Integrate Qwen3-VL-4B-Instruct through a normalized HTTP adapter. Own factual, versioned prompts, multi-frame inputs, batching, timeouts, caching and failures. Preserve supporting timestamps and avoid invented actions. |
| P12 | Ons | Generate summaries through the HTTP LLM from captions and events, linked to source chunks. Begin with specified 10-minute/hour levels; extend to day-level summaries for long-range reasoning. Version prompts and provenance. |
| P13 | Gheith Mahmoud | Embed captions/summaries and write visual, caption and summary collections to Qdrant plus the lexical/BM25 index. Preserve filters and provenance. Supply compatible query encoders and retrieval-facing index interfaces. |
| P14 | Gheith Mahmoud | Validate complete metadata, vectors, lexical entries, evidence references and required summaries for an index revision. Return a validation result that P15 uses for atomic publication. |
| P15 | Mohamed Elgheith | Publish only validated revisions and complete their jobs. Integrate reprocessing and existing deletion/retention with every new artifact/index. Keep a valid prior revision usable during replacement. |
| P16 | Mohamed Elgheith | Implement Stage 2 simulated RTSP ingestion and worker scheduling with bounded indexing delay and stable timelines. Reuse the agreed indexing concurrency/recovery policy. |
| P17 | Mohamed Elgheith | Coordinate processing performance and reliability measurements. Each owner measures their stage's throughput, memory, costs and recovery; Ali owns perception/count/attribute accuracy. Record actual model/hardware settings. |

### Worker sequence and ownership

1. Gheith Mahmoud prepares timeline, chunks and frame references through P06.
2. Ali runs perception and activity/redundancy selection through P08-P09, coordinating final chunk boundaries with P06.
3. Gheith Mahmoud generates visual embeddings through P10.
4. Mohamed Elgheith generates VLM captions through P11.
5. Ons generates summaries through P12.
6. Gheith Mahmoud generates text embeddings and completes index validation through P13-P14.
7. Mohamed Elgheith publishes the revision and completes the job through P15.

Required representations must validate before publication. Externally served model unloading/resource coordination is explicit. VLM and LLM weights stay in their HTTP services.

<!-- pdf-page-break -->

## 2. Retrieval

Retrieval covers a question through a grounded answer with evidence. The interactive workflow runs in the FastAPI backend. It searches published, authorized index revisions and calls LLM/VLM services through HTTP.

### Planning, searching and grounding

| ID | Owner | Work and handoff |
| --- | --- | --- |
| R01 | Boutheina | Define query-plan, ranked-result and grounded-moment contracts. Agree the answer/evidence contract with Ons and processing references with P01. Deliver fixture requests/results and explicit errors. |
| R02 | Boutheina | Parse intent, cameras, absolute/relative time, objects, attributes, actions and aggregation. Validate structured plans and apply the sensitive-attribute filter. Resolve time against the correct camera/timeline. |
| R03 | Boutheina | Implement dense visual/text retrieval, BM25 search and typed SQL event/count queries. Use the encoders/index interfaces from P10/P13. Preserve retriever provenance. |
| R04 | Boutheina | Enforce authorization, camera/time filters and published-revision visibility in every search path. Handle unavailable/deleted recordings and stale candidates consistently. |
| R05 | Boutheina | Fuse results, expand queries, rerank and select candidate windows. Route counting to event queries and range summaries to summary retrieval. Own later cross-camera appearance/time queries with Ali's track outputs, subject to the specification's privacy rules. |
| R06 | Gheith Mahmoud | Implement baseline temporal grounding using query/frame embedding similarity, smoothing and thresholds. Return scored start/end moments in absolute and relative time using the original timeline. |
| R07 | Boutheina | Implement and evaluate the trained grounding model on QVHighlights/Charades-STA, adapt to UCA and compare with the baseline. Match the R06 application contract. |
| R08 | Ons | Implement online LLM HTTP integration, normalized answer output and a bounded tool-calling loop. Apply provider timeouts, retries, tool budgets and explicit failure handling. |
| R09 | Ons | Connect typed search, event, summary, grounding and clip-inspection tools. Preserve original user intent, access restrictions and evidence provenance when the LLM rewrites a search query. |

Online LLM planning and tool calls can be developed with fixtures while the real index is being built. Report fixture integration separately from retrieval accuracy and model performance.

<!-- pdf-page-break -->

### Evidence, product and evaluation

| ID | Owner | Work and handoff |
| --- | --- | --- |
| R10 | Mohamed Elgheith | Expose query-time VLM verification through the shared adapter from P11. Inspect authorized candidate evidence on demand and return structured observations supporting R09. Query-time verification runs through the backend. |
| R11 | Ons | Generate English/French/Arabic answers, check citations and SQL-derived counts, calibrate confidence and implement abstention. Build coarse-to-fine long-range reasoning using P12 summaries and evidence tools. |
| R12 | Ons | Deliver chat, streamed responses, synchronized player jumps, evidence cards/thumbnails and event timeline end to end. Reuse existing frontend components, tokens and notifications. |
| R13 | Ons | Implement durable query/history/tool/evidence records, user feedback, evidence export and query-purpose/returned-clip audit. Enforce existing roles and evidence-access rules in backend endpoints. |
| R14 | Mohamed Elgheith | Implement later standing-query rule management/status UI and worker-only scheduling/evaluation over new indexed outputs. Integrate the specified alerts and role policy. |
| R15 | Ons | Coordinate SurvQA question/label format, validation/test split, manual verification and evaluation tooling. All five members write and cross-check questions and evidence intervals. Maintain dataset/licence records. |
| R16 | Boutheina | Evaluate planner field accuracy, evidence retrieval and trained grounding; compare baselines/ablations. Gheith Mahmoud supplies baseline-grounding measurements and error analysis. |
| R17 | Ons | Evaluate answer accuracy, citation precision, faithfulness, abstention, multilingual behaviour and query latency. Maintain verified answer/evidence examples and safety checks. Own the stretch public long-video QA benchmark comparison. |
| R18 | Mohamed Elgheith | Coordinate full-system integration, access/deletion consistency, failure recovery and performance versus archive size. Assemble the running demo and release with module owners. |

### Required evaluation scope

The development clips support early integration. The cahier des charges still requires 5-8 camera-days of 2-8 hours each, with at least 20 hours total, and 400-600 SurvQA questions with at least 15% unanswerable. It also requires the named retrieval/grounding datasets and a scalability demonstration with an index of at least 50 hours.

The final Stage 2 delivery includes at least two features, including streaming ingestion or long-range reasoning. P16, P12/R11, R10 and R14 have explicit owners; their delivery order follows the baseline. R05 and R17 also assign the cross-camera query extension and stretch public long-video QA comparison, retaining their specified scope.

<!-- pdf-page-break -->

## Starting work and dependency handoffs

These are initial recommendations based on the inspected scaffold. Refresh them against the actual checkout in each chat. Readiness for component development and readiness for live integration are assessed separately.

| Team member | Work that can start | Prerequisite for live integration |
| --- | --- | --- |
| Mohamed Elgheith | Start P01 and the P02-P03 job persistence/orchestration foundation. Define producer/consumer fixtures with the owners. | Real stage outputs and P14 validation are needed for P15 publication. A placeholder stage cannot establish successful indexing. |
| Ali | Start P07 camera lines/zones using existing cameras and stored recordings. Develop P08 against a known clip and the draft frame contract. | Final frame/timeline interfaces from P01/P06, versioned configuration and P03 execution are needed for durable pipeline integration. |
| Gheith Mahmoud | Start P05 manifests and P06 standalone decoding/timing. Draft P10/P13 embedding/index interfaces and R06 fixtures. | Agree P01/R01 contracts; P09 final selections feed visual indexing, and P11/P12 outputs feed caption/summary indexing. |
| Boutheina | Start R01 and develop R02-R05 using agreed fixture chunks, events and index payloads. Set up the R07 benchmark/data protocol. | Real P09 events, P10/P13 searchable indexes and published revisions from P15 are needed for live searches. |
| Ons | Co-design R01 and start R08/R12 against fixture tools/results. Draft P12 summary prompts with fixture captions/events and start R15 protocol. | P11/P09 feed real summaries; R03-R06/R10 and published data are needed for real evidence-backed answers. |

### First integration milestones

1. Agree P01/R01 contract drafts and fixtures, including timestamp conventions, storage references, embedding spaces and evidence citations. Follow the specification's versioning/approval process when freezing or changing shared contracts.
2. Connect P02-P03 with P06 and persist real preparation outputs for one CITIC recording. Expose later unimplemented stages honestly.
3. Integrate Ali's versioned camera configuration and perception outputs, then visual embeddings, captions, summaries and text indexes in order. Validate before publishing.
4. Connect the online retrieval/grounding tools and answering UI to that published index. Review evidence jumps, counts and unanswerable questions manually before reporting end-to-end results.
5. Expand to the specified camera-days, benchmarks and selected Stage 2 features. Measure quality, runtime and scaling on real data.

### Collaboration and upkeep

Use separate feature branches and small reviews. Module owners propose their persistence migrations and interface changes; Mohamed Elgheith coordinates shared files, migration order and integration. Ownership is a coordination aid, not an approval requirement for ordinary authorized implementation.

Each owner updates module documentation, relevant model/configuration records, verification results and their report section. Everyone reviews another module, writes/verifies SurvQA questions and presents their contribution. Record handoffs with task ID, input/output version, implemented scope, verification evidence and remaining dependencies. Keep temporary identity/session notes out of committed files.

The Markdown file is the editable team reference. The companion PDF is a dated export at `output/pdf/RecallCam_Team_Work_Split.pdf`. Update both when responsibilities or dependency expectations change; agents determine actual completion from code and recorded evidence.

### Project references

- [Cahier des charges](RecallCam_Cahier_des_Charges.md), Sections 3, 7-12 and 14, defines scope, contracts, evaluation and deliverables.
- [Architecture](Architecture.md) and [Sequential pipeline](Sequential_Pipeline.md) define the processing/query boundary and stage order.
- [PostgreSQL application design](PostgreSQL_App_Design.md) defines job/configuration and query persistence expectations.
- [Development](Development.md) records implementation status; [UI system](../DESIGN.md) defines frontend consistency.
- [Agent instructions](../AGENTS.md) define session identity and task-readiness checks.
