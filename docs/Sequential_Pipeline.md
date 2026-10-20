# RecallCam sequential video processing pipeline

This document records implementation choices for processing recorded videos in the MVP. It supplements the [cahier des charges](RecallCam_Cahier_des_Charges.md); the specification remains the authority for scope, required features, data contracts, evaluation, and acceptance criteria. These choices do not remove its baseline or advanced requirements.

The pipeline runs sequentially by stage for one video. A stage may process frames or chunks in batches, including batches of one. The worker finishes that stage for the video before starting the next model stage. It does not run the complete sequence separately for every chunk.

This design is independent of the development operating system and hardware. The [architecture document](Architecture.md) describes the API, worker, Redis queue, storage, and model services.

[Playback preparation](Playback_Preparation.md) is a separate, explicitly requested media job for browser compatibility. It does not start or change this indexing pipeline. Indexing uses the original through a validated decoder; browser inability to play MPEG does not by itself prevent FFmpeg frame extraction. No decoder supports every possible or damaged file, so M1 must validate decoding and timing before CV receives frames. The 5 FPS CV sampling policy must not be applied to the browser playback copy.

## 1. Overall order

```text
Backend accepts and stores a recorded video
    ↓
Video stays in the library without indexing until administrator selects Process
    ↓
Backend creates a durable job and queues its reference in Redis
    ↓
Worker claims the video job
    ↓
1. Prepare video, timestamps, provisional chunks, and frame references
    ↓
2. CV over the video: detect, track, extract attributes and events
   Finalize activity selection and remove redundant VLM candidates
    ↓
3. Visual embeddings of retained keyframes; pool per chunk
    ↓
4. VLM captions for active chunks through HTTP
    ↓
5. LLM summaries from captions and events through HTTP
    ↓
6. Text embeddings of captions and summaries
    ↓
7. Finalize and validate vector, lexical, and metadata indexes
    ↓
Worker records completion; video becomes available for normal retrieval
    ↓
Worker claims the next video job
```

Outputs and progress are saved throughout processing, rather than only at the end. Finalization checks that the required representations are complete and consistent. It does not require keeping all index writes until the last step.

## 2. Stage 1: prepare the video

The backend has already stored the original video before indexing starts. The worker reads it through a storage reference and validates its duration, frame timing, camera identifier, and recording start time.

The worker establishes both video-relative seconds and absolute camera timestamps, following Section 8 of the specification. Every derived frame, chunk, track, event, and caption retains its connection to that original timeline.

Use the specification's fixed-chunk baseline as the initial reference: for example, 10-second chunks with 2-second overlap and one candidate keyframe every 2 seconds. The 10-second length is an example in the specification, not a newly imposed universal value. Adaptive chunking and static-period merging remain part of the specified work.

Initial boundaries may be provisional. Activity detected during the CV stage can refine the representation before final chunk records and embeddings are produced. Keep the source-to-chunk mapping reproducible and resolve final chunk identifiers before writing dependent records.

The initial CV sampling choice is **5 FPS**, the lower end of the specified 5–10 FPS range. Camera resolution may vary; this document does not prescribe a fixed input resolution or mandatory resize.

Stream decoded frames or use bounded batches and stored references. Sequential execution does not mean loading an entire video's frames into RAM.

## 3. Stage 2: CV and activity selection

### 3.1 Process the sampled frames

Run the perception methods required by M2: detection and tracking of the relevant classes, visual attributes, carried-object association, and events such as line crossings, zone occupancy, stops, and dwell time. The exact CV model and tracker selection follow the specification and project evaluation; this document does not select a replacement.

CV processes the sampled timeline before VLM filtering. A frame rejected for captioning is not automatically rejected from detection, tracking, counting, or event extraction.

Maintain tracking continuity across processing batches and chunk boundaries. Overlapping chunks must not cause duplicate tracks, events, or counts for the same source observation. Store tracks, events, timestamps, and confidence in PostgreSQL as specified.

CV boxes are data used for tracking, attributes, selection, and optional visualization. This pipeline does not require burning boxes into the original video. Keep the original footage and its timeline available as evidence.

### 3.2 Separate activity selection from redundancy removal

Apply two related decisions before captioning:

1. **Activity selection:** identify intervals with relevant activity or meaningful changes to the camera scene.
2. **Redundancy removal:** choose informative frames within those intervals instead of repeatedly sending equivalent views.

Object presence alone is insufficient. A permanently parked vehicle should not trigger a new VLM request on every sampled frame. Conversely, an unchanged background does not make foreground activity redundant.

Use tracking and temporal context together with inexpensive scene or foreground changes. Useful signals include a new track, line crossing, zone entry or exit, object handling, a changed carried object, or an object appearing, disappearing, or moving. A stopped object or stationary person can still matter for dwell-time questions even when repeated captions are unnecessary.

| Observation                                    | Caption selection behavior                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Empty corridor with no meaningful change       | Compress the static representation; avoid repeated VLM calls.                                  |
| Same parked vehicle in the same state          | Retain its presence and time coverage; avoid repeated equivalent captions.                     |
| Person appears or crosses a configured line    | Keep frames that explain the appearance or crossing.                                           |
| Person stands still for a long period          | Preserve track duration and dwell facts; avoid repeated equivalent visual descriptions.        |
| Person handles or leaves a bag                 | Keep frames around the interaction and its outcome.                                            |
| Object remains after a person leaves           | Preserve the change and the remaining object even without a person in the later frame.         |
| Meaningful scene change or uncertain detection | Keep candidates for review/captioning rather than relying only on a positive object detection. |

Do not make successful detection of a specific object class the only gate. Include scene-change or periodic fallback checks so detector misses and activity outside the chosen classes can be evaluated. Thresholds and fallback intervals are implementation parameters to validate, not numbers prescribed by the specification.

### 3.3 Finalize chunks and frame selections

Use the activity results to finalize adaptive boundaries and static-period merging where applicable. Compression reduces duplicate processing and index entries; it does not remove time from the original recording or erase evidence of quiet intervals.

Keep separate references for:

- Keyframes retained for the visual index and chunk representation.
- Frames selected as VLM inputs for each active chunk.
- Structured tracks and events over the sampled timeline.

The selections can overlap, but they do not have to contain the same number of frames. One candidate keyframe every 2 seconds does not mean one mandatory VLM call every 2 seconds.

Cache equivalent source-frame work, including frames shared by overlapping chunks. Preserve a representation and time coverage for retained static chunks even when no new VLM caption is generated. Record why captioning was skipped; absence of a caption must not be interpreted as proof that nothing happened.

The specification does not prescribe a fixed VLM image rate or images per chunk. Choose the smallest informative selection that still supports factual chunk captions, then evaluate retrieval quality and missed events. Do not silently discard an active chunk merely to meet an arbitrary request budget.

## 4. Stage 3: visual embeddings

After CV processing and selection finish for the video, run the visual embedding stage. Use the keyframe/chunk representations required by M3, including the baseline CLIP/SigLIP approach and pooling where applicable.

Compute each reusable frame embedding once and associate or pool it into the corresponding chunks. Store the model version, chunk identifiers, camera, and time range with the indexed representation. Chunks without VLM activity can still need visual representation.

Complete this stage for the video before starting VLM captioning. Save outputs between batches and release worker-owned model resources at the stage boundary when needed.

## 5. Stage 4: VLM captioning through HTTP

For each active chunk, send the selected frame or frames and a versioned factual captioning prompt to the configured VLM service. The worker makes HTTP requests; it does not load VLM weights or run VLM inference in its own process.

The current VLM choice is Qwen3-VL-4B-Instruct. The tested MLX 4-bit artifact is one deployment option, not an operating-system requirement. The endpoint, served model identifier, protocol, and credentials are configuration.

Caption people, visible clothing and carried objects, actions, interactions, relevant colours, and observable counts as required by M3. Omit repetitive background description unless it helps explain or locate the activity. Preserve the specification's sensitive-attribute restrictions. Structured CV counts remain the authority for counting queries.

Do not infer intent, identity, sound, or unobserved actions. A still image showing a person near a door does not by itself establish entry. Use a sequence of selected frames or a supported tracking event for temporal claims. If CV context is supplied to the captioner, retain its provenance and distinguish it from what the image establishes. Attach timestamps from video metadata rather than asking the model to invent them.

The output remains associated with individual active chunks. Grouping similar frames is an inference optimization, not a replacement of all chunk captions with one whole-video caption. Reuse cached descriptions only when the relevant visual content and supported actions match; an earlier entry event must not be repeated as a new entry in later chunks.

Start with one outstanding caption request at a time. A request containing several frames describes one chunk; several independent requests processed concurrently are a separate optimization. Concurrency and frames per request require benchmarking and are not assumed in this sequential baseline.

Keep the VLM available throughout this stage rather than loading it for every chunk. If model services share constrained hardware, coordinate their resource lifecycle through the serving layer. Sequential worker stages alone do not automatically unload models held by another service.

## 6. Stage 5: LLM summaries through HTTP

Once the video's chunk captions and events are available, request the hierarchical summaries required by M3, including 10-minute and hourly summaries. Follow the specification for further hierarchy and project phasing.

Send captions, event facts, and timeline metadata to the configured text LLM service. Retain links to the source child chunks. The worker orchestrates the requests; the LLM runs in a separate service.

The text LLM therefore participates in indexing for summaries as well as in the online query path. Its role is not limited to answering user questions.

## 7. Stage 6: text embeddings

After captions and summaries are available, embed the required text using the multilingual text embedding approach in M3. Process the text in bounded batches, storing vectors and provenance incrementally.

Use the corresponding text embedding model/version for query text and indexed text. Keep visual and text embedding collections identifiable; do not mix incompatible vector spaces after a model change.

This HTTP-service decision applies specifically to VLM and LLM inference. CV and embedding deployment locations can be chosen separately without changing the pipeline's data contracts.

## 8. Stage 7: finalize and validate indexes

Verify the visual, caption, summary, lexical/BM25, and structured metadata representations required by the specification. Check chunk/time references, child-summary links, processing coverage, and model/schema versions.

Record completion only when the required work for that video has succeeded. If a service is unavailable, preserve completed stages and expose a failed, retryable, or partial state as appropriate; do not label an incomplete index as fully complete. The specification's graceful query degradation still applies.

## 9. Sequential scheduling and recovery

The initial schedule is one video job at a time and one model stage at a time within that job. Batching changes the amount of data processed per step, not the stage order:

```text
CV batch 1 → CV batch 2 → ... → CV finished for video
Visual embedding batch 1 → ... → visual stage finished
VLM chunk requests → ... → caption stage finished
LLM summary requests → ... → summary stage finished
Text embedding batches → index validation → completed
```

Do not schedule `CV → embeddings → VLM` repeatedly for every chunk if doing so causes model switching and loading overhead. The next video's processing begins after the current job completes or leaves execution through a recorded failure/retry policy.

Persist stage and batch checkpoints. Retries resume or safely repeat unfinished work using idempotent writes and stable identifiers. Cache keys must include the relevant inputs, selection policy, model, prompt, and processing versions so stale results are not silently reused.

The backend remains available for application requests while the worker processes videos. Sequential indexing does not require making the entire application sequential. Shared hardware can still cause contention, so record actual latency and throughput rather than assuming isolation guarantees a speed target.

## 10. Choices and requirements remain distinguishable

| Topic                                                      | Source requirement or documented choice                                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| CV sampling                                                | Choice: start at 5 FPS, within M2's 5–10 FPS range.                                                             |
| Activity-only captioning and static compression            | Required strategy in M1 and Section 9.2.                                                                        |
| Chunk captions, embeddings, BM25, and summaries            | M3 requirements; retained by this stage schedule.                                                               |
| Stage order and stage-wide model reuse                     | Implementation choices recorded here.                                                                           |
| VLM and LLM inference over HTTP                            | Implementation choice recorded in the architecture.                                                             |
| Model selection, evaluation, and advanced work             | Continue to follow the specification; current Qwen choice is documented and benchmarked.                        |
| Resolution, selection thresholds, and VLM frames per chunk | Not fixed here; configure and evaluate them.                                                                    |
| Indexing performance                                       | Preserve the specification's targets and reference-machine context; no Mac- or Windows-specific timing promise. |
