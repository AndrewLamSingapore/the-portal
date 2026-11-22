# THE PORTAL: cloud support and deployment

Refreshed 22 November 2026. Ten slides including the cover, with a working-product demonstration, cloud architecture, deployment, support and a sourced AI biology case study.


## 1. THE PORTAL

Explore ideas. Follow the evidence.

Speaker notes:

Hello, I’m Andrew Lam. THE PORTAL is my working discovery prototype. I’ll show the application, explain its cloud deployment, and demonstrate how I approach support.

Sources: https://github.com/AndrewLamSingapore/the-portal and https://the-portal-ten.vercel.app/cloud-support. Cover artwork: the project’s original portal-cinematic.webp.


## 2. The working website

An idea is the starting point

Open a card to see its question, connections and evidence label.

Speaker notes:

This is the working website. Visitors can explore existing ideas immediately, open the cloud guide, or inspect the biology case study. The archive contains discovery prompts, including imagined objects and dates. The evidence label explains how to read each card.

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

[Switch to the website for about 60 seconds.] I’ll open an existing archive card, show its evidence label and inspect its source trail. Unsourced details carry an explicit speculative warning. I’ll point out a question and connection, then open the Cloud guide link. [Return to the slides.] The same application gives us a concrete system to deploy and support.

Demo: https://the-portal-ten.vercel.app/#explore. Use existing records without generating new content or casting a public verdict. Screenshot: the public card drawer on 22 November 2026.

Evidence labels: AI-CURATED means a generated discovery prompt. CONCEPTUAL-INFERENCE means an interpretive relationship. HISTORICALLY-VERIFIED requires curator review and a source trail. A connection does not establish causation.


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


## 6. Cloud deployment

| Step | Implementation | Release check |
| --- | --- | --- |
| 1. GitHub | Branch and pull request | Review the change |
| 2. Checks | Contracts, tests and dependency audit | Review passing results |
| 3. Preview | Vercel candidate deployment | Check desktop and mobile |
| 4. Production | Merge to the connected main branch | Confirm deployment is READY |
| 5. Live checks | Health, archive and graph | Match the intended Git revision |

Speaker notes:

I develop the change on a Git branch and open a pull request. Automated checks run before release, while Vercel creates a preview for user-flow and mobile review. After the reviewed merge, the connected project deploys production. I then check the public URL and compare the live health revision with the intended Git commit. A green build is one stage of release validation.

Sources: .github/workflows, RELEASE.md, vercel.json and scripts/production-smoke.mjs in https://github.com/AndrewLamSingapore/the-portal. Public walkthrough: https://the-portal-ten.vercel.app/cloud-support#deployment.


## 7. Cloud support

Health checks guide the next investigation

| Observed issue | Layer to investigate | First checks |
| --- | --- | --- |
| Page or assets unavailable | Hosting or domain | Deployment state and HTTP response |
| Shared archive unavailable | API or database | Health response and function logs |
| Generation request fails | Function or model service | Request error, configuration and limits |
| Unexpected release appears | Deployment or alias | Live revision against the Git commit |

Speaker notes:

For support, I first record the failing page and action. If the page loads but the archive fails, I investigate the API and database. If generation alone fails, I inspect the function response, configuration and limits. The public health, status and readiness endpoints help locate the failing layer. If a release causes a regression, I can recover to a known working Vercel deployment, then verify the affected action and revision. Recovery is an operator action.

Support report: include time, URL, action, expected result, observed error and revision. Exclude credentials and private payloads.

Sources: https://the-portal-ten.vercel.app/cloud-support#support, /api/health, /api/status and /api/readiness; scripts/production-smoke.mjs and the repository configuration guide.


## 8. AI and biology today

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


## 9. The biology research frontier

Five capabilities, with gaps between them

- **READ**: Interpret measured sequence data.
- **UNDERSTAND**: Model genes, proteins and their interactions.
- **SIMULATE**: Estimate effects within a defined model.
- **DESIGN**: Propose candidates for evaluation.
- **VALIDATE**: Test predictions against independent evidence.

Speaker notes:

Biology is one case study inside the discovery platform. READ, UNDERSTAND, SIMULATE, DESIGN and VALIDATE organize separate research capabilities. Reliable prediction across DNA regulation, proteins, cells, tissues and a whole organism remains a major integration challenge. THE PORTAL presents this evidence and open question. It does not run biological simulation or genetic editing.

Conceptual synthesis. Sources: AlphaGenome https://doi.org/10.1038/s41586-025-10014-0; Evo 2 https://doi.org/10.1038/s41586-026-10176-5; virtual cell perspective https://doi.org/10.1016/j.cell.2024.11.015. General whole-body programmability remains speculative.


## 10. Your next question

Which idea would you investigate?

Speaker notes:

THE PORTAL gives us a working application whose cloud deployment and support can be explained and checked. Try an existing card, open the cloud guide, or inspect the biology sources. Which claim would you investigate, and what evidence would change your view? Thank you.

Live website: https://the-portal-ten.vercel.app/
Cloud guide: https://the-portal-ten.vercel.app/cloud-support
Biology case study: https://the-portal-ten.vercel.app/ai-biology
Source: https://github.com/AndrewLamSingapore/the-portal
Background: the project’s original portal-cinematic.webp.
