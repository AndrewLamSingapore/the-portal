# THE PORTAL: ten-slide presentation

Refreshed 22 November 2026 for a general classroom and public audience. Ten slides including the cover. Each slide includes a spoken script and source references.


## 1. THE PORTAL

Explore ideas. Follow the evidence.

Speaker notes:

Hello, I’m Andrew Lam. THE PORTAL helps people explore ideas, discover connections, and see what the evidence supports. Let me show you how it works.

Source: https://github.com/AndrewLamSingapore/the-portal. Cover artwork: the project’s original portal-cinematic.webp.


## 2. The working website

An idea is the starting point

Open a card to see its question, connections and evidence label.

Speaker notes:

This is the working website. I have kept the introduction short so visitors can explore immediately. The shared archive contains discovery prompts. Some use imagined objects and dates, so the evidence label matters. The biology link opens a separate case study with primary research sources.

Source and screenshot: https://the-portal-ten.vercel.app/, public refresh of 22 November 2026.


## 3. The discovery loop

- **01  ENCOUNTER**: Open an idea or create a discovery prompt.
- **02  CONNECT**: Follow shared concepts and inspect sources.
- **03  EXPERIMENT**: Turn the open question into a bounded test.
- **04  EVOLVE**: Record results and reconsider the idea.

Speaker notes:

An encounter gives us something to investigate. Connections suggest where to look next. An open question can lead to a small test, and the result can change our view. This is the project’s discovery approach. I still need user studies to establish whether it improves learning or discovery outcomes.

Sources: README.md, app.js and lib/knowledge.js in https://github.com/AndrewLamSingapore/the-portal.


## 4. A 60-second demonstration

- **OPEN**: Choose an existing archive card.
- **CHECK**: Read its evidence label and source trail.
- **FOLLOW**: Explore a related idea or open question.

Speaker notes:

[Switch to the website for about 60 seconds.] I’ll open an existing card and point to its evidence label. If it has no source trail, the drawer explicitly describes its details as speculative. I’ll then show its unresolved question and a conceptual connection. [Return to the slides.] The graph offers directions for investigation. A connection alone does not prove causation.

Demo: https://the-portal-ten.vercel.app/#explore. Use existing cards. No new generation or public verdict is needed. If the archive is unavailable, use this screenshot and the biology case study. Screenshot: the live public card drawer on 22 November 2026.


## 5. The cloud architecture

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Browser | HTML, CSS and JavaScript | Interface and private local cabinet |
| Server API | Vercel functions | Request validation and server credentials |
| Shared archive | PostgreSQL through Neon | Persistent records and relationships |
| AI generation | Explicit server request | Structured prompts with evidence labels |

Speaker notes:

The browser presents the interface and stores the private cabinet locally. Vercel functions validate requests and keep credentials on the server. The shared archive uses PostgreSQL through Neon when configured. AI generation runs only after an explicit request. My implementation work here includes the public interface and evidence presentation. The source describes these components, while deployment checks establish what is actually live.

Sources: ARCHITECTURE.md, CONFIGURATION.md, app.js, lib/db.js and api/artifact.js in https://github.com/AndrewLamSingapore/the-portal.


## 6. Evidence labels

The label tells you how to read the claim

- **AI-CURATED**: A generated discovery prompt.
- **CONCEPTUAL-INFERENCE**: An interpretive relationship to investigate.
- **HISTORICALLY-VERIFIED**: A curator-reviewed record with a source trail.

Speaker notes:

These labels keep different kinds of content visible. AI-curated material starts a question. A conceptual inference proposes a relationship. A historically verified record requires curator review and a source trail. The interface also warns when a record lacks sources. The biology case study uses primary papers and keeps its proposed workflow explicitly conceptual.

Sources: app.js evidenceBadge(), visibleArtifactSources() and detailMarkup(); https://the-portal-ten.vercel.app/ai-biology.


## 7. AI and biology today

| Capability | Current scope |
| --- | --- |
| Analyze DNA sequence data | Established for defined tasks |
| Prioritize disease-associated variants | Research tools, clinical validation required |
| Predict protein structures | Established for many targets |
| Design DNA or protein candidates | Demonstrated in research |
| Assist gene-editing design | Demonstrated in research |
| Predict every effect of an edit | Limited |
| Simulate a whole human cell reliably | Research frontier |
| Safely reprogram a whole human body | No demonstrated general capability |

Speaker notes:

Biology shows why these distinctions matter. AI can analyze DNA sequence data and predict many protein structures. Researchers also use it to propose sequences and editing tools. A useful prediction still needs validation for its intended setting. We do not yet have a reliable general model of a whole human cell or a way to safely reprogram an entire human body.

Primary sources reviewed 22 November 2026:
AlphaGenome, Nature (2026): https://doi.org/10.1038/s41586-025-10014-0
AlphaMissense, Science (2023): https://doi.org/10.1126/science.adg7492; clinical-use limitation: https://github.com/google-deepmind/alphamissense
AlphaFold 3, Nature (2024): https://doi.org/10.1038/s41586-024-07487-w
Evo 2, Nature (2026): https://doi.org/10.1038/s41586-026-10176-5
OpenCRISPR, Nature (2025): https://doi.org/10.1038/s41586-025-09298-z
Virtual cell perspective, Cell (2024): https://doi.org/10.1016/j.cell.2024.11.015


## 8. A biology research workflow

Five capabilities, with gaps between them

- **READ**: Interpret measured sequence data.
- **UNDERSTAND**: Model genes, proteins and their interactions.
- **SIMULATE**: Estimate effects within a defined model.
- **DESIGN**: Propose candidates for evaluation.
- **VALIDATE**: Test predictions against independent evidence.

Speaker notes:

This five-stage workflow is a conceptual way to organize the research. Separate tools already address parts of it. The gap is reliable integration across the stages and biological scales. THE PORTAL helps us explore that question and its sources. It does not perform biological simulation or genetic editing.

Conceptual synthesis. Sources: AlphaGenome https://doi.org/10.1038/s41586-025-10014-0; Evo 2 https://doi.org/10.1038/s41586-026-10176-5; virtual cell perspective https://doi.org/10.1016/j.cell.2024.11.015.


## 9. The prediction frontier

What happens after DNA changes?

| Biological scale | What models must account for |
| --- | --- |
| DNA and regulation | Which genes change activity, where and when |
| Proteins and cells | Interactions, feedback and cellular context |
| Tissues and organs | Delivery, coordination and different responses |
| Whole organism | Environment, time and unintended effects |

Speaker notes:

A change in DNA can have different consequences across cells, tissues and time. Better molecular predictions help with parts of that problem. They do not settle every downstream effect. For me, the useful research question is how prediction improves as evidence connects these biological scales. Each application needs its own validation. General whole-body programmability remains speculative.

Sources: Evo 2 https://doi.org/10.1038/s41586-026-10176-5 and the virtual cell perspective https://doi.org/10.1016/j.cell.2024.11.015. This multiscale summary is an interpretation of the research frontier.


## 10. Your next question

Which idea would you investigate?

Speaker notes:

THE PORTAL begins with curiosity and keeps the evidence visible. Try one card or the biology case study. Which claim would you investigate, and what evidence would change your view? Thank you.

Live website: https://the-portal-ten.vercel.app/
Biology case study: https://the-portal-ten.vercel.app/ai-biology
Source: https://github.com/AndrewLamSingapore/the-portal
Background: the project’s original portal-cinematic.webp.
