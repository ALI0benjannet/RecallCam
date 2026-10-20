> RecallCam — Cahier des Charges  \|  Tradrly IT Solutions

**CAHIER DES CHARGES**

# RecallCam

Video RAG for Long Surveillance Footage: Semantic Search, Temporal Grounding and Question Answering over Hours of Video

**Advanced Computer Vision Capstone Project — Video-Language Track**

*Concept overview of the RecallCam product (illustrative mock-up)*

| **Project information** |  |
| --- | --- |
| **Duration** | 10 weeks |
| **Team size** | 5–6 data science students |
| **Data modality** | Long surveillance video + natural language |
| **Main datasets** | UCA (UCF-Crime Annotation), QVHighlights, Charades-STA + original SurvQA benchmark |
| **Supervisor** | Salah Sammari — CEO &amp; CTO, Tradrly IT Solutions |
| **Document version** | v1.0 — October 2026 |

## Table of Contents

- [1. Context and Problem Statement](#section-1)
- [2. Project Objectives](#section-2)
- [3. Scope and Phasing](#section-3)
- [4. Responsible AI and Legal Framework](#section-4)
- [5. Users and Use Cases](#section-5)
- [6. Functional Architecture](#section-6)
- [7. Detailed Module Specifications](#section-7)
- [8. Shared Data Contract](#section-8)
- [9. Datasets and Original Benchmark](#section-9)
- [10. Non-Functional Requirements](#section-10)
- [11. Evaluation Protocol and Metrics](#section-11)
- [12. Team Organisation and Roles](#section-12)
- [13. Planning and Milestones](#section-13)
- [14. Deliverables](#section-14)
- [15. Technology Stack and Compute](#section-15)
- [16. Risks and Mitigations](#section-16)
- [17. Project Governance and Assessment](#section-17)
- [18. Future Work and Glossary](#section-18)
- [19. Validation](#section-19)

*Right-click the table and choose "Update Field" if page numbers are not displayed.*

<a id="section-1"></a>

## 1. Context and Problem Statement

### 1.1 Context

A building with ten cameras records 240 hours of video every day. When something must be checked — "when did the delivery arrive?", "did anyone enter the storage room after 18:00?", "what happened in the parking lot this afternoon?" — an operator must scroll manually through hours of footage with only a time slider. Existing video management systems index video by camera and time only; the content of the video itself is not searchable.

Large language models changed how we search text: Retrieval-Augmented Generation (RAG) lets an LLM answer questions over millions of documents by first retrieving the relevant passages. Recent **video-language models** (VLMs) can describe and reason about short clips, but they cannot read hours of video at once: context windows, memory and cost make this impossible. Bridging this gap — answering questions over very long video with precise, verifiable time references — is an active research and industry problem.

### 1.2 Problem statement

> **Core research question**
>
> Can we build a Video RAG system that ingests hours of multi-camera surveillance video, indexes it with visual, textual and structured representations, and answers natural-language questions — lookup, counting, summarisation and anomaly questions — with an exact answer, the precise video segment(s) as evidence, and an explicit "not found" when the evidence does not exist?

The difficulty is not one model but the **interaction of many components**: how to cut the video into chunks, what to store for each chunk (embeddings, captions, objects, counts), how to retrieve the right chunk among tens of thousands, how to refine to the exact second (temporal grounding), how to combine many pieces of evidence for questions that span hours (long-video reasoning), and how to guarantee that the final answer is supported by the video rather than hallucinated by the LLM.

### 1.3 Positioning

This project is complementary to an incident-detection project on surveillance video: RecallCam does not try to raise alarms automatically. It is an **investigation and search tool**: the operator asks, the system finds and proves. The technical core is video-language understanding, retrieval and grounding, not anomaly classification.

<a id="section-2"></a>

## 2. Project Objectives

### 2.1 General objective

Design, implement and evaluate **RecallCam**, a Video RAG platform that ingests long multi-camera surveillance recordings, builds a multimodal index, and answers natural-language questions through a chat interface, returning answers with timestamped evidence clips, a temporal localisation of the relevant moments, and calibrated "not found" responses.

### 2.2 Specific objectives

1. **Ingest and chunk long video** from several cameras with absolute timestamps, using adaptive (scene-aware) chunking and keyframe selection.

2. **Extract structured metadata:** detect and track persons, vehicles and carried objects; extract visual attributes (clothing and object colours); count entries and exits through virtual lines; store everything in an event table.

3. **Build a multimodal index:** visual embeddings, dense VLM captions, text embeddings and hierarchical summaries, stored in a vector database with metadata filters.

4. **Understand and plan queries:** classify the question type (moment lookup, counting, summary, anomaly, tracking), extract time ranges, cameras and attributes, and route to the right retrieval strategy.

5. **Retrieve and re-rank:** hybrid retrieval (dense + lexical + structured SQL) followed by cross-modal re-ranking and VLM verification.

6. **Ground answers in time:** a temporal grounding model returns precise start and end times of the moment matching the query.

7. **Generate faithful answers:** an LLM agent composes the answer only from retrieved evidence, cites clips with timestamps, and abstains when evidence is missing.

8. **Create an original benchmark (SurvQA):** long "camera-day" videos with verified question–answer–timestamp triples to evaluate the whole system end-to-end.

9. **Deliver a usable product:** chat dashboard with synchronised video player, evidence strip and event timeline; streaming ingestion in Stage 2.

### 2.3 What the system is — and what it is not

| **RecallCam IS** | **RecallCam IS NOT** |
| --- | --- |
| A search and investigation assistant over recorded video. | An automatic alarm or judgement system. |
| Appearance-based search on clothing, objects and vehicles ("person with a red backpack"). | A face recognition or person identification system. Faces are never matched to identities. |
| A system that answers only from retrieved evidence and says "not found" otherwise. | A chatbot that guesses or fills gaps with plausible text. |
| A research prototype on public datasets and consented recordings. | A system deployed on real public cameras without legal authorisation. |

<a id="section-3"></a>

## 3. Scope and Phasing

**MVP (weeks 1–7):** complete Video RAG pipeline over recorded multi-hour footage. **Stage 2 (weeks 8–10):** streaming ingestion, standing queries and advanced long-video reasoning. Stage 2 starts only after MVP validation.

### 3.1 MVP — weeks 1 to 7 (mandatory)

| **Area** | **MVP features** |
| --- | --- |
| **Ingestion** | Batch ingestion of recorded videos from multiple (simulated) cameras with absolute timestamps; adaptive chunking; keyframes. |
| **Perception** | Detection and tracking of persons, vehicles and bags; colour attributes; line crossing counts; event table. |
| **Indexing** | Visual embeddings per keyframe/chunk; VLM caption per chunk; text embeddings; vector DB with metadata (camera, time, objects). |
| **Query types** | Q1 moment lookup ("when did…"), Q2 counting ("how many…"), Q3 time-range summary ("summarise 14:00–16:00"), Q4 event search ("find all thefts / falls / vehicles stopping"). |
| **Retrieval** | LLM query planner + hybrid retrieval + re-ranking. |
| **Grounding** | Temporal grounding model trained on QVHighlights / Charades-STA, adapted to UCA. |
| **Answering** | LLM answer with clip citations, timestamps, confidence and abstention. |
| **Product** | Chat UI, video player jumping to cited segments, evidence thumbnails strip, event timeline; API. |

### 3.2 Stage 2 — weeks 8 to 10 (advanced)

| **Feature** | **Description** |
| --- | --- |
| **Streaming ingestion** | Index a live (simulated RTSP) stream continuously with bounded delay; questions about "the last 10 minutes". |
| **Standing queries / alerts** | User-defined natural-language watch rules ("notify me if a vehicle stops at the entrance for more than 5 minutes") evaluated on new chunks. |
| **Hierarchical long-video reasoning** | Multi-level summaries (chunk → 10 min → hour → day) and an agent that navigates them (coarse-to-fine search) for questions spanning hours. |
| **Cross-camera tracking query (Q5)** | Follow a person across cameras by appearance description and time continuity, returning an ordered list of sightings (no face recognition). |
| **VLM verification loop** | The agent re-opens candidate clips with a VLM to verify a hypothesis before answering ("is the backpack really red?"). |
| **Evaluation on long-video QA benchmarks (stretch)** | Run the reasoning module on a public long-video QA benchmark subset to compare with published systems. |

### 3.3 Out of scope

- Face recognition, identity matching, watchlists, licence-plate reading.

- Queries about protected or sensitive attributes (ethnicity, religion, health, presumed gender, age estimation).

- Training a video-language model from scratch; the project fine-tunes and composes existing models.

- Deployment on real cameras or use of footage of non-consenting people outside public research datasets.

<a id="section-4"></a>

## 4. Responsible AI and Legal Framework

A searchable archive of surveillance video is a powerful capability that can be misused for tracking people. Responsible-AI requirements are therefore **functional requirements** of RecallCam.

| **#** | **Principle** | **Concrete implementation in RecallCam** |
| --- | --- | --- |
| P1 | No identification | No face recognition, no face embeddings in the index, no linking of a person to an identity. Person search is limited to visible clothing, carried objects and position. |
| P2 | Sensitive-attribute filter | The query planner rejects queries that target protected attributes (ethnicity, religion, health, etc.) with a clear message; captions are generated with a prompt that forbids describing such attributes. Tested with an adversarial query set. |
| P3 | Evidence-only answers | Every factual statement in an answer cites at least one clip (camera, start, end). An automatic checker verifies that cited clips exist and were retrieved; uncited statements are removed. |
| P4 | Honest abstention | If retrieval confidence is below a calibrated threshold the system answers "No matching evidence found in the indexed period" and shows the closest candidates as "low confidence". |
| P5 | Purpose and access control | Role-based access; each query is logged with user, time, purpose field and returned clips; the supervisor can audit the log. |
| P6 | Data minimisation | Configurable retention; deletion of a video removes all derived embeddings, captions and metadata. |
| P7 | Bias and failure analysis | Report retrieval failures by lighting, camera distance, crowd density and attribute (e.g., colour confusion at night). |

In Tunisia, video surveillance and the processing of personal data are governed by Organic Law n° 2004-63 on the protection of personal data under the supervision of the INPDP. The project is a **research prototype** using public research datasets under their licences and, optionally, staged recordings of consenting adult volunteers. The final report must include a short data-protection impact note for a hypothetical real deployment.

> **Licence reminder**
>
> UCF-Crime / UCA, QVHighlights and Charades-STA are released for research use; each has its own terms. Videos must not be redistributed or uploaded to public repositories. If an external LLM/VLM API is used, no video frame of a licence-restricted dataset may be sent to it unless the licence allows it — prefer locally hosted open models.

<a id="section-5"></a>

## 5. Users and Use Cases

### 5.1 User roles

| **Role** | **Description** | **Permissions** |
| --- | --- | --- |
| Operator | Security or facility agent investigating footage. | Ask questions, view answers and evidence clips, give feedback. |
| Supervisor | Responsible for investigations and audits. | All operator rights + export of evidence clips, query audit log, standing queries. |
| Administrator | Technical administrator. | Camera / video management, users, retention, model versions. |

### 5.2 Supported question types

| **Type** | **Example** | **Expected answer** | **Main components** |
| --- | --- | --- | --- |
| Q1 Moment lookup | When did a person with a red backpack enter? | Timestamp(s) + camera + clip(s). | Attributes, dense retrieval, grounding |
| Q2 Counting | How many people entered today? How many vehicles came in after 18:00? | Number + supporting list of events. | Tracking, line crossing, SQL |
| Q3 Time-range summary | Summarise what happened between 14:00 and 16:00. | Ordered list of notable events with timestamps. | Hierarchical summaries, LLM |
| Q4 Event search | Find all moments where someone took an object from a car / a fight / a fall. | List of candidate segments ranked by confidence. | Dense retrieval, VLM verification, grounding |
| Q5 Cross-camera follow (Stage 2) | Where did the person in the grey hoodie go after leaving camera 1? | Ordered sightings across cameras. | Appearance embedding, time continuity |
| Q6 Yes/No + abstention | Did anyone enter the storage room after 22:00? | "No evidence found" or evidence clips. | Calibration, abstention |

*Figure 1 — Expected interaction: question list, moment lookup with evidence strip, and time-range summary with event timeline (concept mock-up)*

<a id="section-6"></a>

## 6. Functional Architecture

RecallCam is organised in an **offline indexing path** (video → chunks → perception → index) and an **online query path** (question → plan → retrieve → ground → answer). Both share the data contract of Section 8.

*Figure 2 — Core pipeline: video input → chunking → indexing → query understanding → answer with clip (concept mock-up)*

*Figure 3 — RecallCam functional architecture*

### 6.1 Query flow (example: "When did a person with a red backpack enter?")

1. The query planner (LLM with structured output) produces: type = Q1, object = person, attributes = {carried: backpack, colour: red}, event = entry, time range = today, cameras = entrance cameras.

2. Structured retrieval: SQL over the event table returns entry events of persons with "red" + "backpack" attributes.

3. Dense retrieval: the text query is embedded and matched against chunk embeddings and caption embeddings, filtered by time and camera.

4. Candidates from both paths are fused (reciprocal rank fusion) and re-ranked by a cross-modal re-ranker; the top-k are verified by a VLM on keyframes.

5. The temporal grounding model refines each verified chunk to an exact start–end.

6. The answer generator writes the answer citing clip IDs; the citation checker validates it; the UI shows the answer, the player positioned at the moment, and the evidence strip.

<a id="section-7"></a>

## 7. Detailed Module Specifications

Each module defines a **baseline** (mandatory, fallback) and an **advanced** approach.

### M1 — Ingestion, Chunking and Long-Video Construction

| **Item** | **Specification** |
| --- | --- |
| **Purpose** | Turn raw recordings into time-aligned chunks and keyframes, and build realistic long test videos. |
| **Inputs** | Video files per camera; camera metadata (ID, name, start time); RTSP stream (Stage 2). |
| **Outputs** | Chunk records (video\_id, camera\_id, chunk\_id, t\_start, t\_end, absolute time, keyframes); synthetic camera-days. |

#### Technical approach

| **Level** | **Method** |
| --- | --- |
| **Baseline** | Fixed-length chunks (e.g., 10 s with 2 s overlap) and 1 keyframe per 2 s. |
| **Advanced** | Adaptive chunking on scene / activity change (frame-difference, embedding-change detection or shot detection such as TransNetV2), merge of static chunks (empty corridor at night), motion-aware keyframe selection. |
| **Camera-days** | Public datasets contain short clips. To test long-video search, the team builds synthetic multi-hour "camera-days" by concatenating clips (e.g., UCA videos grouped by scene type) with a consistent absolute timeline, keeping the original annotations re-timed. Each camera-day lasts 2–8 hours. |
| **Stage 2** | Streaming ingestion from a simulated RTSP source (MediaMTX) with bounded indexing delay. |

#### Functional requirements

- Every chunk has absolute and relative timestamps consistent across all modules.

- Static/empty periods are compressed so that index size grows with activity, not duration.

- Camera-day generation is scripted and reproducible.

#### Acceptance criteria

- Ingestion throughput ≥ 10× real time (without VLM captioning) on the reference machine.

- At least 5 camera-days totalling ≥ 20 hours of video are built.

### M2 — Perception and Structured Metadata

| **Item** | **Specification** |
| --- | --- |
| **Purpose** | Produce exact, queryable facts (who/what/where/when) that LLMs and embeddings are bad at, such as counts and entries. |
| **Inputs** | Frames at 5–10 FPS; camera configuration (entrance lines, zones). |
| **Outputs** | Track table (track\_id, class, time span, camera, attributes) and event table (entry, exit, stop, zone enter, loitering) in PostgreSQL. |

#### Technical approach

| **Level** | **Method** |
| --- | --- |
| **Detection &amp; tracking** | YOLO + ByteTrack / BoT-SORT for persons, cars, motorcycles, bicycles, bags / backpacks / suitcases. |
| **Attributes** | Baseline: dominant colour of upper / lower body and of carried objects from segmentation masks or box crops (colour clustering in HSV / Lab). Advanced: pedestrian attribute recognition model or zero-shot CLIP attribute scoring ("red backpack", "grey hoodie"). |
| **Events** | Virtual line crossing (direction-aware entries / exits), zone occupancy, stationary vehicle detection (dwell time), loitering. |
| **Association** | Carried object linked to the person track that overlaps it most consistently. |

#### Functional requirements

- All tracks and events stored with time, camera and confidence.

- Counts per period answerable by SQL alone.

- No face crops or face embeddings stored.

#### Acceptance criteria

- Entry/exit count error ≤ 10% on annotated test camera-days.

- Colour attribute accuracy reported per colour and per lighting condition.

### M3 — Multimodal Indexing and Vector Database

| **Item** | **Specification** |
| --- | --- |
| **Purpose** | Represent every chunk so that it can be found from a natural-language query. |
| **Inputs** | Chunks and keyframes (M1), tracks and events (M2). |
| **Outputs** | Vector collections (visual, caption, summary), metadata payloads, BM25 index over captions, hierarchical summaries. |

#### Technical approach

| **Level** | **Method** |
| --- | --- |
| **Visual embeddings** | Baseline: CLIP / SigLIP image embeddings of keyframes (mean or max pooled per chunk). Advanced: video-text encoder embeddings per chunk (e.g., X-CLIP / InternVideo-class models) and fine-tuning on UCA text–clip pairs with contrastive loss. |
| **Dense captions** | An open VLM (e.g., Qwen-VL, InternVL or LLaVA-Video family, chosen after a week-1 benchmark) generates a factual caption per chunk with a structured prompt (people, objects, actions, colours, counts), forbidden from describing protected attributes. Optional fine-tuning on UCA captions. |
| **Text index** | Caption embeddings (sentence-transformer / multilingual embedding model, to support English, French and Arabic queries) + BM25 index. |
| **Hierarchical summaries** | LLM summaries per 10 minutes and per hour built from chunk captions and event tables, each linked to its child chunks. |
| **Vector DB** | Qdrant (recommended) or Milvus / FAISS; payload filters on camera, time range, object classes, event types. |

#### Functional requirements

- Indexing is incremental (new videos added without re-indexing everything).

- Each vector points to its chunk and absolute time range.

- Captioning cost (GPU-seconds per video hour) is measured and reported.

#### Acceptance criteria

- Text-to-chunk retrieval Recall@10 on UCA test ≥ 50% with the best index (baseline reported).

- Indexing of one video hour (with captions) ≤ 20 minutes on the reference GPU.

### M4 — Query Understanding and Hybrid Retrieval

| **Item** | **Specification** |
| --- | --- |
| **Purpose** | Find the right chunks among tens of thousands, for each type of question. |
| **Inputs** | User question (+ conversation context); index (M3); event table (M2). |
| **Outputs** | Query plan (JSON); ranked candidate chunks with scores and provenance. |

#### Technical approach

| **Level** | **Method** |
| --- | --- |
| **Query planner** | LLM with JSON-schema constrained output: question type (Q1–Q6), time range (absolute / relative: "this afternoon", "after 6 pm"), cameras, objects, attributes, actions, aggregation. Includes the sensitive-attribute filter (P2). |
| **Baseline retrieval** | Dense retrieval on caption embeddings with metadata filters. |
| **Advanced retrieval** | Hybrid: dense visual + dense caption + BM25 + SQL over events, fused by reciprocal rank fusion; query expansion (synonyms, multilingual); cross-modal re-ranker (cross-encoder on caption or VLM yes/no scoring on keyframes). |
| **Routing** | Counting questions answered primarily by SQL with retrieved clips as supporting evidence; summary questions routed to hierarchical summaries; event search to dense + verification. |

#### Functional requirements

- Planner output validated against a schema; invalid plans are retried or the user is asked to rephrase.

- Every candidate keeps provenance (which retriever found it).

- Relative time expressions resolved correctly against the camera-day clock.

#### Acceptance criteria

- Planner field accuracy ≥ 90% on a 150-question test set.

- SurvQA chunk retrieval Recall@5 ≥ 70% (target ≥ 80%).

- Ablation: each retriever alone vs. hybrid vs. hybrid + re-ranking.

### M5 — Temporal Grounding (Moment Retrieval)

| **Item** | **Specification** |
| --- | --- |
| **Purpose** | Return the exact start and end of the moment described by the query inside retrieved video windows. |
| **Inputs** | Query text; a candidate window (e.g., 30–150 s around retrieved chunks). |
| **Outputs** | Ranked moments (start, end, score); optional highlight (saliency) curve. |

#### Technical approach

| **Level** | **Method** |
| --- | --- |
| **Baseline** | Similarity curve between the query embedding and per-second frame embeddings (CLIP), smoothing and thresholding. |
| **Advanced** | DETR-style moment retrieval model (Moment-DETR / QD-DETR / UniVTG family) trained on QVHighlights and Charades-STA, then fine-tuned on UCA temporal sentence grounding; comparison with zero-shot VLM grounding. |
| **Domain adaptation** | Measure the drop from QVHighlights/Charades to surveillance (UCA); fine-tune on UCA training split. |

#### Functional requirements

- Moments returned in absolute time and in clip-relative time.

- Window-level grounding works on any window produced by M4.

#### Acceptance criteria

- QVHighlights val: R1@0.5 ≥ 55% (target ≥ 60%); Charades-STA test: R1@0.5 ≥ 50% (target ≥ 58%).

- UCA grounding results reported before and after fine-tuning.

### M6 — Answer Generation and Long-Video Reasoning

| **Item** | **Specification** |
| --- | --- |
| **Purpose** | Compose a correct, concise and fully evidenced answer, also for questions spanning hours. |
| **Inputs** | Question, plan, verified and grounded candidates, event table results, summaries. |
| **Outputs** | Answer text, list of cited clips (camera, start, end, thumbnail), confidence, "not found" status. |

#### Technical approach

| **Level** | **Method** |
| --- | --- |
| **Baseline** | Single LLM call with retrieved captions, events and timestamps in the prompt; mandatory citation format \[clip\_id\]; refusal instruction when evidence is missing. |
| **Advanced (agent)** | Tool-using LLM agent: search\_chunks, query\_events (SQL), get\_summary(range), ground\_moment, inspect\_clip (VLM question on a clip). Coarse-to-fine strategy for long ranges; limit on number of tool calls; final answer with citations. |
| **Faithfulness** | Citation checker: every sentence must cite retrieved clips; numbers in the answer must match SQL results; failed answers are regenerated or degraded to "evidence list only". |
| **Calibration** | Answer confidence from retrieval + verification scores, calibrated on the validation part of SurvQA; threshold for abstention. |

#### Functional requirements

- Answers in the language of the question (English, French or Arabic).

- Each answer shows cited clips that open the player at the right second.

- Explicit "not found" when appropriate.

#### Acceptance criteria

- SurvQA answer accuracy ≥ 60% (target ≥ 75%), judged against ground truth.

- Citation precision ≥ 85%; hallucinated (unsupported) statements ≤ 5% of answers.

- Abstention: ≥ 80% correct "not found" on unanswerable questions.

- Median query latency ≤ 8 s (target ≤ 5 s).

### M7 — Backend, Chat Dashboard and Streaming

| **Item** | **Specification** |
| --- | --- |
| **Purpose** | Make the system usable for investigation. |
| **Inputs** | Videos, index, user questions; stream (Stage 2). |
| **Outputs** | REST + WebSocket API, chat UI, player, evidence strip, timeline, audit log, standing-query notifications. |

#### Technical approach

| **Level** | **Method** |
| --- | --- |
| **Backend** | FastAPI, PostgreSQL (metadata, events, audit), Qdrant, object storage for video, Celery / RQ for indexing jobs, model serving (vLLM or similar for the LLM / VLM). |
| **Frontend** | React / Next.js: camera and period selector, chat with streamed answers, video player synchronised with citations, evidence thumbnail strip, event timeline per period, feedback buttons (correct / wrong clip). |
| **Stage 2** | Live indexing status, standing queries with notifications via WebSocket. |

#### Functional requirements

- Clicking a citation seeks the player to the cited start time.

- Every query and returned clip is logged (P5).

- Feedback stored for evaluation and re-ranker tuning.

#### Acceptance criteria

- End-to-end demo: ingest camera-day → ask Q1–Q4 questions → answers with correct clips.

- Stage 2: a standing query fires within 30 s of the matching event in the simulated stream.

<a id="section-8"></a>

## 8. Shared Data Contract

Drafted in week 1, **frozen as v1 at the end of week 2**; later changes require a version bump and supervisor approval. Validated with Pydantic / JSON Schema.

| **Element** | **Convention** |
| --- | --- |
| **Time** | Absolute ISO-8601 timestamps (camera clock) + seconds relative to video start. |
| **IDs** | camera\_id, video\_id, chunk\_id (video\_id + index), track\_id unique per video, event\_id UUID. |
| **Clip reference** | {camera\_id, t\_start\_abs, t\_end\_abs, chunk\_ids\[\]} — the unit of citation everywhere. |
| **Attributes** | Controlled vocabulary: 11 basic colours; object classes from COCO subset; event types enumeration. |
| **Versioning** | schema\_version and producing module version in every record. |

### 8.1 Example — indexed chunk (M1 + M2 + M3)

```json
{ "schema_version": "1.0", "chunk_id": "cam01-2024-01-16-000512",
  "camera_id": "CAM01", "t_start_abs": "2024-01-16T14:23:10", "t_end_abs": "2024-01-16T14:23:22",
  "keyframes": ["kf/000512_0.jpg", "kf/000512_1.jpg"],
  "caption": "A person wearing a dark jacket and a red backpack walks through the
              entrance door toward the camera. No other people are visible.",
  "objects": ["person", "backpack"], "events": ["ENTRY:track_57"],
  "tracks": [ { "track_id": 57, "class": "person",
               "attributes": { "upper_colour": "black", "carried": [ {"backpack": "red"} ] } } ],
  "vectors": { "visual": "siglip@1.0", "caption": "multilingual-e5@1.0" } }
```

### 8.2 Example — answer (M4 + M5 + M6)

```json
{ "query": "When did a person with a red backpack enter?",
  "plan": { "type": "Q1", "objects": ["person"], "attributes": {"carried": "backpack", "colour": "red"},
            "event": "ENTRY", "range": ["2024-01-16T00:00", "2024-01-16T23:59"] },
  "answer": "A person with a red backpack entered through the main entrance at 14:23:15 [c1].",
  "citations": [ { "id": "c1", "camera_id": "CAM01",
                   "t_start_abs": "2024-01-16T14:23:12", "t_end_abs": "2024-01-16T14:23:19",
                   "score": 0.83, "found_by": ["sql", "dense_caption"], "verified": true } ],
  "confidence": 0.81, "status": "ANSWERED", "latency_ms": 4120 }
```

<a id="section-9"></a>

## 9. Datasets and Original Benchmark

*Figure 4 — Main public datasets (concept mock-up)*

| **Dataset** | **Content (approximate — verify in week 1)** | **Used for** | **Access** |
| --- | --- | --- | --- |
| UCA (UCF-Crime Annotation) | Fine-grained sentence descriptions with start/end timestamps for the UCF-Crime surveillance videos (about 1,800 videos, more than 100 hours, over 20,000 sentences); defined tasks include temporal sentence grounding, captioning and dense captioning. | M3 caption / embedding fine-tuning, M5 surveillance grounding, SurvQA construction. | Public annotations; videos from UCF-Crime (research use). |
| QVHighlights | About 10,000 YouTube videos (~150 s) with over 10,000 natural-language queries, moment spans and saliency scores. | M5 moment retrieval training and benchmark (val set; test via official server). | Public, research use. |
| Charades-STA | Indoor daily activity videos with about 16,000 sentence–moment pairs. | M5 grounding training and benchmark. | Public, research use. |
| UCF-Crime | Long untrimmed real surveillance videos (normal + 13 anomaly types). | Source video for camera-days and event search (Q4). | Public, research use. |
| Long-video QA benchmark (optional) | A public long-video question-answering benchmark selected in week 1. | Stage 2 stretch evaluation of the reasoning agent. | Per benchmark terms. |

### 9.1 Original contribution: SurvQA benchmark

No public benchmark evaluates question answering with timestamped evidence over **multi-hour surveillance** video. The team builds one.

| **Aspect** | **Specification** |
| --- | --- |
| **Videos** | 5–8 camera-days (2–8 h each) built from UCA / UCF-Crime clips (Section M1), plus optional staged recordings with consenting volunteers. |
| **Questions** | 400–600 questions covering Q1–Q6, in English with a subset in French and Arabic; at least 15% unanswerable questions (to test abstention). |
| **Generation** | Semi-automatic: templates and LLM paraphrasing from UCA sentences and the M2 event table (e.g., counts), then 100% manual verification of answer and timestamps by two students. |
| **Labels** | Ground-truth answer, answer type, list of evidence intervals (camera, start, end), difficulty (single-hop / multi-hop / long-range). |
| **Splits** | Validation (for calibration and tuning) / test (frozen in week 5, used only for final results), split by camera-day. |
| **Quality** | Inter-annotator agreement on answers and interval IoU ≥ 0.5 between annotators reported. |

### 9.2 Compute-saving strategy

- Compress static periods before captioning; caption only chunks with activity.

- Use quantised (4/8-bit) open VLMs/LLMs served with an efficient inference server; cache all captions and embeddings.

- Train grounding models on pre-extracted features (official feature releases of QVHighlights / Charades-STA when available).

<a id="section-10"></a>

## 10. Non-Functional Requirements

| **Category** | **Requirement** |
| --- | --- |
| **Performance** | Query latency median ≤ 8 s (target ≤ 5 s) on a 24 h index; indexing ≤ 20 min per video hour including captions. |
| **Scalability** | Index of ≥ 50 hours of video demonstrated; retrieval latency growth reported vs. index size. |
| **Multilinguality** | Questions in English, French and Arabic; answers in the question language. |
| **Reliability** | Resumable indexing jobs; graceful degradation when the VLM or LLM is unavailable (evidence list only). |
| **Security &amp; privacy** | RBAC, JWT, query audit log, sensitive-attribute filter, no face data, retention and deletion. |
| **Reproducibility** | Versioned prompts, model versions and seeds; configs in Hydra/YAML; experiment tracking; Docker. |
| **Code quality** | Type hints, ruff, black, pytest (contract, planner parsing, citation checker), reviewed pull requests, CI. |

<a id="section-11"></a>

## 11. Evaluation Protocol and Metrics

Targets are indicative; they must be compared with published results collected during the literature review. Component metrics and end-to-end metrics are both mandatory.

| **Component** | **Metric** | **Dataset** | **MVP** | **Stretch** |
| --- | --- | --- | --- | --- |
| M2 Counting | Count error (%) | Annotated camera-days | ≤ 10% | ≤ 5% |
| M2 Attributes | Colour accuracy | Annotated crops | reported | by condition |
| M3 Retrieval | Text→chunk Recall@1/5/10 | UCA test | R@10 ≥ 50% | R@10 ≥ 65% |
| M4 Planner | Field accuracy | 150 planner questions | ≥ 90% | ≥ 95% |
| M4 Retrieval | Recall@5 of evidence chunks | SurvQA test | ≥ 70% | ≥ 80% |
| M5 Grounding | R1@0.5, R1@0.7, mAP | QVHighlights val | R1@0.5 ≥ 55% | ≥ 60% |
| M5 Grounding | R1@0.5, R1@0.7, mIoU | Charades-STA test | R1@0.5 ≥ 50% | ≥ 58% |
| M5 Grounding | R1@0.5, mIoU | UCA test | reported | gain after fine-tuning |
| M6 QA | Answer accuracy (exact / LLM-judged with human check) | SurvQA test | ≥ 60% | ≥ 75% |
| M6 Evidence | Citation precision; evidence interval IoU ≥ 0.5 | SurvQA test | ≥ 85% | ≥ 90% |
| M6 Faithfulness | % answers with unsupported statements | SurvQA test | ≤ 5% | ≤ 2% |
| M6 Abstention | Correct "not found" rate; false "not found" rate | SurvQA unanswerable subset | ≥ 80% | ≥ 90% |
| P2 Safety | Rejection rate of sensitive-attribute queries | Adversarial query set (≥ 50) | ≥ 95% | 100% |
| System | Query latency, indexing speed | 24 h index | ≤ 8 s | ≤ 5 s |

### 11.1 Mandatory analyses

- **Ablations:** chunk length (5 / 10 / 30 s, adaptive); visual-only vs. caption-only vs. hybrid retrieval; with / without re-ranking and VLM verification; baseline LLM vs. agent; with / without hierarchical summaries for long-range questions.

- **Scaling study:** retrieval accuracy and latency as the index grows from 2 h to 50+ h (does the right chunk get lost?).

- **Error analysis by stage:** for each wrong answer, identify whether the failure comes from perception, indexing, retrieval, grounding or generation (error attribution table).

- **Cost analysis:** GPU-seconds per video hour for indexing and per query.

<a id="section-12"></a>

## 12. Team Organisation and Roles

| **Role** | **Main responsibilities** | **Key deliverables** |
| --- | --- | --- |
| **R1 — Ingestion &amp; Perception Lead** | M1 chunking, camera-days, M2 detection, tracking, attributes, events, SQL schema. | Camera-days, event table, counting and attribute evaluation. |
| **R2 — Indexing Lead** | M3 embeddings, VLM captioning and prompts, hierarchical summaries, vector DB, contrastive fine-tuning on UCA. | Index pipeline, retrieval benchmarks, captioning cost study. |
| **R3 — Retrieval Lead** | M4 query planner, hybrid retrieval, fusion, re-ranking, sensitive-attribute filter. | Planner test set, retrieval ablations, adversarial query set. |
| **R4 — Temporal Grounding Lead** | M5 baselines and DETR-style models on QVHighlights / Charades-STA, UCA fine-tuning. | Grounding models and benchmark tables. |
| **R5 — Reasoning &amp; Evaluation Lead** | M6 answer generation, agent and tools, citation checker, calibration; SurvQA benchmark coordination and end-to-end evaluation. | SurvQA benchmark, agent, QA results and error attribution. |
| **R6 — Platform &amp; MLOps Lead** | Data contract, model serving, M7 backend and chat UI, streaming and standing queries, Docker, CI. | Running platform, API docs, demo. |

> **Adaptation for a team of 5**
>
> Role R4 is merged: R2 takes the grounding baseline (similarity curve) and R3 trains the DETR-style grounding model after the retrieval baseline is complete; SurvQA question writing is shared equally by all five students.

### 12.1 Shared responsibilities

- Everyone writes and verifies SurvQA questions (weeks 2–5, about 80–100 questions per student).

- Everyone writes the report section of their module, reviews another one, and presents their module in the defence.

<a id="section-13"></a>

## 13. Planning and Milestones

*Figure 5 — 10-week Gantt chart with integration milestones*

| **Week** | **Objectives** | **Expected outputs** |
| --- | --- | --- |
| **W1** | Kick-off; literature review (video RAG, long-video understanding, moment retrieval, VLMs, surveillance video-language); dataset downloads; benchmark of 2–3 candidate VLMs / LLMs on sample chunks; repo and CI. | State-of-the-art summary, model selection note, draft data contract. |
| **W2** | Chunking + camera-day builder; data contract v1 frozen; SurvQA protocol; first detection/tracking runs; CLIP index on sample. | Contract v1, first camera-day, SurvQA guide. |
| **W3** | Event table and counts; CLIP-based vector DB baseline; grounding baselines; backend skeleton. | MS1 review package. |
| **W4** | VLM captioning at scale; caption index; query planner v1; grounding training on QVHighlights / Charades-STA; SurvQA questions writing. | Retrieval baseline results. |
| **W5** | Hybrid retrieval + re-ranking; UCA fine-tuning of grounding; answer generator v1 with citations; SurvQA test set frozen; chat UI v1. | First answers end-to-end on one camera-day. |
| **W6** | Agent with tools; citation checker; calibration and abstention; hierarchical summaries v1; integration. | Full MVP pipeline. |
| **W7** | MVP stabilisation and evaluation on SurvQA; latency optimisation; MVP demo. | MS2 — MVP validated. |
| **W8** | Stage 2: streaming ingestion, standing queries, cross-camera follow, VLM verification loop. | Stage 2 prototypes. |
| **W9** | Ablations, scaling study, error attribution, cost analysis, adversarial safety tests; documentation. | Complete results; draft report. |
| **W10** | Code freeze; final report, model and dataset cards, demo video; rehearsal and defence. | MS3 — final delivery. |

### 13.1 Milestones

| **Milestone** | **Date** | **Validation criteria** |
| --- | --- | --- |
| **MS1 — Foundations** | End of week 3 | Data available; at least 2 camera-days built; data contract frozen; event table and CLIP index working; grounding baseline evaluated on Charades-STA; repo, CI, Docker skeleton. |
| **MS2 — MVP** | End of week 7 | Ingest a camera-day → ask Q1–Q4 in the chat → answers with correct cited clips and grounded timestamps, abstention when appropriate; SurvQA MVP metrics reported vs. baselines. |
| **MS3 — Final** | End of week 10 | At least two Stage 2 features (one must be streaming ingestion or long-range reasoning with hierarchical summaries); ablations, scaling and error attribution; all deliverables; defence. |

<a id="section-14"></a>

## 14. Deliverables

| **#** | **Deliverable** | **Description** |
| --- | --- | --- |
| D1 | Source code repository | README, installation guide, configs, prompts (versioned), tests, CI, docker compose. |
| D2 | Models + model cards | Fine-tuned embedding / grounding models and cards; documented choice of VLM and LLM. |
| D3 | SurvQA benchmark | Camera-day build scripts, questions, answers, evidence intervals, guide, agreement study (annotations only; no video redistribution). |
| D4 | Evaluation suite | Scripts for every metric (retrieval, grounding, QA, faithfulness, abstention, safety) and notebooks for all tables and figures. |
| D5 | Running platform | Backend + chat dashboard with demo index, OpenAPI documentation, user guide. |
| D6 | Technical report | 30–45 pages: context, state of the art, architecture, methods, experiments, ablations, scaling, error attribution, responsible AI and data-protection note, limitations, future work. |
| D7 | Demo video &amp; presentation | 3–5 minute demo (moment lookup, counting, summary, abstention, Stage 2 feature) and slides for a 25-minute defence. |

<a id="section-15"></a>

## 15. Technology Stack and Compute

| **Area** | **Recommended tools** |
| --- | --- |
| **Language &amp; DL** | Python 3.11, PyTorch, Hugging Face Transformers, open\_clip |
| **Video** | FFmpeg, PyAV / decord, PySceneDetect or TransNetV2, MediaMTX (Stage 2) |
| **Perception** | Ultralytics YOLO, ByteTrack / BoT-SORT, supervision |
| **VLM / LLM** | Open VLMs and LLMs (selected in week 1), served with vLLM or Ollama; quantisation (AWQ / GPTQ / bitsandbytes) |
| **Embeddings &amp; retrieval** | CLIP / SigLIP, multilingual text embeddings, rank\_bm25, cross-encoder re-rankers |
| **Vector DB &amp; data** | Qdrant (or Milvus / FAISS), PostgreSQL, Redis, MinIO |
| **Grounding** | Moment-DETR / QD-DETR / UniVTG reference implementations |
| **Orchestration** | LangGraph or LlamaIndex (optional) — or a lightweight custom agent loop with JSON tools |
| **Backend / frontend** | FastAPI, Pydantic, Celery / RQ; React / Next.js, HTML5 video, WebSocket |
| **Experiments &amp; DevOps** | W&amp;B or MLflow, Hydra, Docker, CI, pytest, ruff, black |

| **Resource** | **Recommendation** |
| --- | --- |
| **Reference GPU** | One shared NVIDIA GPU with ≥ 24 GB VRAM recommended (a 7B-class quantised VLM + LLM serving and captioning). 16 GB is workable with 4-bit models and sequential jobs. |
| **Captioning budget** | Plan GPU-hours for captioning: with activity-based compression, target ≤ 20 min per video hour; run overnight jobs and cache all outputs. |
| **Fallback** | Kaggle / Colab for grounding model training on pre-extracted features; external APIs only for text-only steps and only if licences allow. |
| **Storage** | ≈ 300–500 GB for videos, keyframes, captions, vectors. |

<a id="section-16"></a>

## 16. Risks and Mitigations

| **Risk** | **Impact** | **Mitigation** |
| --- | --- | --- |
| VLM captioning too slow / GPU-limited | High | Activity-based compression, smaller quantised VLM, keyframe-only captioning, overnight batch jobs, caching. |
| LLM hallucinates facts or timestamps | High | Evidence-only prompting, citation checker, SQL for numbers, abstention threshold, faithfulness metric. |
| Domain gap: grounding trained on YouTube / indoor videos | Medium | UCA fine-tuning; report gap explicitly; re-ranking with VLM verification. |
| No public long-surveillance QA benchmark | High | SurvQA benchmark built from week 2 with verified labels (original contribution). |
| Colour / attribute errors at night or low resolution | Medium | Attribute confidence, combine with caption retrieval, per-condition analysis, honest limitations. |
| Retrieval degrades as the index grows | Medium | Metadata filters, hierarchical index, re-ranking; scaling study. |
| Misuse for tracking individuals | High | P1–P7 implemented; no face data; sensitive-attribute filter; audit log; research-only scope. |
| Integration complexity (many models) | Medium | Data contract frozen in week 2, mocks, model serving behind one API, weekly integration day. |

<a id="section-17"></a>

## 17. Project Governance and Assessment

### 17.1 Working method

- **Weekly sprint meeting** with the supervisor (45 min): demo, metrics, blockers, plan.

- **Daily asynchronous stand-up** and Kanban board linked to pull requests.

- **Prompt and model registry:** every prompt and model version used in an experiment is versioned in the repository.

- **Change log:** any change of scope or data contract is recorded and approved by the supervisor.

### 17.2 Assessment criteria (indicative)

| **Criterion** | **Weight** | **What is evaluated** |
| --- | --- | --- |
| **Technical quality** | 25% | Quality of the retrieval, grounding and reasoning stack; appropriate advanced methods. |
| **Scientific rigour** | 20% | Baselines, official metrics, ablations, scaling study, error attribution. |
| **Integration &amp; product** | 20% | End-to-end Video RAG, chat UI with evidence, Stage 2 features. |
| **Original contribution** | 10% | SurvQA benchmark, faithfulness / abstention mechanisms. |
| **Responsible AI** | 10% | P1–P7, safety tests, data-protection note. |
| **Documentation** | 10% | Report, cards, README, API docs, user guide. |
| **Presentation &amp; teamwork** | 5% | Defence, demo, individual mastery, collaboration. |

<a id="section-18"></a>

## 18. Future Work and Glossary

- Audio indexing (speech, alarms, glass breaking) for multimodal search.

- Natural-language camera configuration ("count people crossing the blue door").

- Edge indexing on embedded GPUs with only metadata and embeddings sent to the server.

- Integration with an incident-detection system: automatic alerts become searchable, explainable events.

### Glossary

| **Term** | **Definition** |
| --- | --- |
| **RAG** | Retrieval-Augmented Generation: retrieve relevant evidence, then generate an answer conditioned on it. |
| **VLM** | Vision-Language Model: model that takes images / video and text as input and produces text. |
| **Chunk** | Short video segment (seconds) that is the unit of indexing and citation. |
| **Temporal grounding / moment retrieval** | Localising the start and end time of a moment described by a sentence. |
| **Hybrid retrieval** | Combining dense (embedding) search, lexical search (BM25) and structured queries (SQL). |
| **Re-ranking** | Second, more precise scoring of the top candidates of a first retrieval stage. |
| **R1@IoU** | Percentage of queries whose top-1 predicted moment overlaps the ground truth with IoU above the threshold. |
| **Faithfulness** | Degree to which every statement of an answer is supported by cited evidence. |
| **Camera-day** | Long synthetic recording built for this project to simulate a full day of a camera. |

<a id="section-19"></a>

## 19. Validation

By signing this document, the supervisor and the team agree on the objectives, scope, responsible-AI framework, planning and deliverables. Each team member confirms having read and accepted Section 4 and the dataset licence terms.

| **Role** | **Name** | **Signature / Date** |
| --- | --- | --- |
| Supervisor | Salah Sammari |  |
| Team representative |  |  |
| Team member |  |  |
| Team member |  |  |
| Team member |  |  |
| Team member |  |  |
| Team member |  |  |
