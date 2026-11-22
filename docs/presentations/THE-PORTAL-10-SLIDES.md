# THE PORTAL: ten-slide presentation outline

Prepared 22 November 2026. Ten slides in total, including the cover. Intended for a general classroom or project audience.

The editable deck includes speaker notes. This source outline records the public narrative and research references.

## 1. THE PORTAL

A living map of imagined futures

Connected discovery and the AI biology frontier


Speaker notes:

Introduce THE PORTAL as Andrew Lam’s working discovery prototype. It explores how encounters connect with ideas, questions and evidence. Explain that the presentation includes an AI biology case study to show how the same approach handles an ambitious scientific frontier. The application supports discovery, curation and evidence exploration. Biological simulation and genetic engineering remain outside the product’s capabilities.

Sources: https://github.com/AndrewLamSingapore/the-portal/tree/ed305c98cc12124b25cf889202652f36dcd77ab4 and the owning repository’s README.md, ARCHITECTURE.md and index.html. Image: original public project artwork, https://the-portal-ten.vercel.app/portal-cinematic.webp.

## 2. The discovery problem

An interesting encounter often ends as an isolated bookmark

- Context: What made this idea possible?
- Connection: Which other ideas does it change?
- Evidence: What would support or challenge it?

Speaker notes:

Describe a familiar experience: saving an article, exhibition or unusual idea, then losing the reason it mattered. THE PORTAL’s product thesis is that a structured encounter can preserve context, connect to other ideas and expose a useful question. This is a design direction, rather than evidence that the application improves learning or discovery outcomes. No engagement or commercial outcome is claimed.

Source: owning repository README.md at ed305c98cc12124b25cf889202652f36dcd77ab4.

## 3. Discovery loop

- 01: ENCOUNTER: Capture an object, observation or imagined future.
- 02: CONNECT: Follow concepts, sources and related encounters.
- 03: EXPERIMENT: Turn an unresolved question into a bounded test.
- 04: EVOLVE: Use results to revise or reject a connection.

Speaker notes:

Walk through the four stages with a simple example. An article about a proposed future becomes a structured encounter. Shared concepts suggest connections. A question becomes an experiment or investigation. New evidence can strengthen, weaken or reject the idea. The broad living-graph vision remains a developing product thesis. Generated connections do not establish causation.

Sources: README.md and lib/knowledge.js in the owning repository.

## 4. Entry points

- The Tribunal: Judge the possible: Consider an unresolved future, then inspect the evidence and anonymous aggregate verdicts.
- The Constellation: Follow hidden echoes: Select graph nodes and explore conceptual relationships or serendipitous connections.
- The Cabinet: Meet the unexpected: Generate a structured discovery through a chosen curator lens and keep a private browser record.

Speaker notes:

Explain the three entry points using their actual public names. The Tribunal supports a public question and anonymous aggregate verdicts. The graph exposes relationships, while the Cabinet supports generated encounters and local records. A vote measures visitor judgment, not scientific truth. Generation calls are explicit and server mediated. A public presentation demo can use existing archive cards to avoid generating new material.

Sources: index.html, app.js, api/trial.js and README.md in the owning repository.

## 5. The working prototype’s architecture


| Layer | Implementation | Boundary |
| --- | --- | --- |
| Browser | Vanilla HTML, CSS and JavaScript | Private cabinet uses browser storage |
| Server API | Vercel functions and structured validation | Credentials stay server-side |
| Shared archive | PostgreSQL via Neon when configured | Persistent artifacts and relationships |
| AI generation | Server-side model request on explicit action | Generated content retains its evidence label |

Speaker notes:

Describe the implementation from the source, rather than implying that the presentation itself verifies all production infrastructure. The browser owns local cabinet records. Vercel functions handle requests and validation. PostgreSQL provides the shared archive when configured. Explicit generation uses the server-side OpenAI Responses API. The product also includes an Evidence Lab and a Living Observatory with their own bounds. A successful source test is separate from private ORQEVIA runtime acceptance.

Sources: package.json, ARCHITECTURE.md, CONFIGURATION.md, api/artifact.js and lib/db.js in the owning repository.

## 6. Evidence labels preserve the distinction

A source link supports review. It does not automatically validate the claim.

- AI-CURATED: A generated discovery prompt that needs independent source checks.
- CONCEPTUAL-INFERENCE: An interpretive relationship that can suggest a question.
- HISTORICALLY-VERIFIED: A curator-reviewed record with an inspectable source trail.

Speaker notes:

Explain the labels before presenting biology. The application displays an explicit warning when a record lacks a source trail, including a record that carries an unsupported verified label. Historical verification applies to a specific record and evidence trail. The new biology material is a curated research case study with primary references. Its five-stage workflow is a conceptual synthesis, and its speculative claims retain that classification.

Sources: app.js evidenceBadge(), visibleArtifactSources(), trialEvidenceText() and index.html.

## 7. AI and biology today

Model predictions require validation in the intended biological setting.


| Capability | Current scope |
| --- | --- |
| Analyze DNA sequences | Established for defined tasks |
| Prioritize disease-related variants | Research tools, clinical review needed |
| Predict many protein structures | Strong demonstrated capability |
| Design DNA and protein candidates | Demonstrated in research |
| Support CRISPR tool design | Demonstrated for selected tasks |
| Predict every edit consequence | Limited and context-dependent |
| Simulate an entire human cell accurately | Research frontier |
| Safely reprogram an entire human body | No demonstrated general capability |

Speaker notes:

AI interprets sequence data from sequencing instruments. AlphaGenome predicts molecular regulatory measurements. AlphaMissense estimates missense variant effects and its released model is not validated or approved for clinical use. AlphaFold 3 predicts biomolecular structures, while Evo 2 demonstrates sequence modelling and design. OpenCRISPR research demonstrates AI-designed editing proteins. These results do not establish comprehensive human-cell simulation or safe whole-body programming.

Primary sources:
AlphaGenome, Nature (2026): https://doi.org/10.1038/s41586-025-10014-0
AlphaMissense, Science (2023): https://doi.org/10.1126/science.adg7492 and https://github.com/google-deepmind/alphamissense
AlphaFold 3, Nature (2024): https://doi.org/10.1038/s41586-024-07487-w
Evo 2, Nature (2026): https://doi.org/10.1038/s41586-026-10176-5
OpenCRISPR, Nature (2025): https://doi.org/10.1038/s41586-025-09298-z
Virtual cell perspective, Cell (2024): https://doi.org/10.1016/j.cell.2024.11.015
Research reviewed 22 November 2026.

## 8. The five-stage biology research workflow

Conceptual architecture. Existing tools cover different parts of the workflow.

- 01: READ: Interpret sequenced DNA and assess its quality.
- 02: UNDERSTAND: Model parts of gene regulation and cellular interactions.
- 03: SIMULATE: Predict a defined effect with uncertainty.
- 04: DESIGN: Propose a candidate sequence or research tool.
- 05: VALIDATE: Compare predictions with independent observations.

Speaker notes:

Present these five capabilities as a conceptual architecture drawn from the user’s question. Separate capabilities already exist in research tools, but they do not combine into a reliable general biological programmer. READ starts with measured data. UNDERSTAND and SIMULATE refer to bounded models. DESIGN proposes candidates. VALIDATE requires independent evidence and appropriate evaluation for the application. This presentation gives no genetic-editing instructions or laboratory protocol.

Sources: AlphaGenome https://doi.org/10.1038/s41586-025-10014-0; Evo 2 https://doi.org/10.1038/s41586-026-10176-5; virtual cell perspective https://doi.org/10.1016/j.cell.2024.11.015. The five-stage synthesis is conceptual.

## 9. Biological scales

The useful frontier is predicting what follows a change, with evidence for each application.


| Scale | What prediction must connect |
| --- | --- |
| DNA and regulation | Sequence changes and gene activity |
| Proteins and cells | Molecular behavior and cellular context |
| Tissues and organs | Interactions between different cell populations |
| Whole organism | Delivery, environment and effects over time |

Speaker notes:

The major integration challenge is a reliable connection across biological scales. A molecular prediction alone cannot settle effects in a tissue, organ or whole organism. Delivery, biological context, environmental effects and longer observation periods matter. Better models may help selected disease treatments or tissue engineering, but each use needs its own evidence. Safe general reprogramming of a human body remains speculative. Within THE PORTAL, the useful artifact is a source-linked research question that can change as evidence improves.

Sources: Evo 2 https://doi.org/10.1038/s41586-026-10176-5; How to build the virtual cell with artificial intelligence https://doi.org/10.1016/j.cell.2024.11.015. This multiscale summary is an interpretation of the research frontier, rather than a validated integrated model.

## 10. The next useful connection

Which prediction would change your mind?

What independent evidence would test it?


Speaker notes:

Close by returning to THE PORTAL’s purpose. Invite the audience to open the biology case study, inspect a primary source and name one claim whose evidence might change their view. The project’s value proposition is a structured way to explore and question relationships. Demonstrated learning outcomes, scientific discovery and commercial adoption remain separate questions.

Live site: https://the-portal-ten.vercel.app/
Biology case study: https://the-portal-ten.vercel.app/ai-biology
Source: https://github.com/AndrewLamSingapore/the-portal

