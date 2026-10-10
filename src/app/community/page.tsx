import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Brand";
import { researchLabs } from "@/lib/research-labs";
import styles from "./FieldGuide.module.css";

export const metadata: Metadata = {
  title: "Field Guide — AI Red Teaming & Community Resources — NestCipher",
  description:
    "A practical AI red-teaming field guide: authored learning labs, private research notes, primary references and teaching-example contributions.",
  alternates: { canonical: "https://nestcipher.com/community" },
};

const resources = [
  {
    category: "PRACTISE",
    title: "Gray Swan Arena",
    description:
      "Explore structured AI red-teaming challenges and the community around them. Read each challenge’s rules and scope before you begin.",
    href: "https://app.grayswan.ai/arena",
    source: "app.grayswan.ai",
  },
  {
    category: "REFERENCE",
    title: "OWASP GenAI Security",
    description:
      "The primary reference for the LLM Top 10, including prompt injection, sensitive information disclosure and excessive agency.",
    href: "https://genai.owasp.org/llm-top-10/",
    source: "genai.owasp.org",
  },
  {
    category: "INVESTIGATE",
    title: "PortSwigger Research",
    description:
      "Follow technical security research and see how researchers explain a vulnerability, its impact and a reproducible technique.",
    href: "https://portswigger.net/research",
    source: "portswigger.net",
  },
  {
    category: "UTILITIES",
    title: "CyberChef",
    description:
      "Decode, transform and inspect data with recipes you can save and share. Useful when an input or output needs a closer look.",
    href: "https://gchq.github.io/CyberChef/",
    source: "gchq.github.io",
  },
];

export default function CommunityPage() {
  return (
    <div className={`site-container ${styles.guidePage}`}>
      <header className={`page-header ${styles.guideHeader}`}>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Field guide</span>
        </nav>
        <p className="eyebrow mt-8">Community / AI red teaming</p>
        <h1 className={styles.guideTitle}>The field guide.</h1>
        <p className={`page-description ${styles.guideDescription}`}>
          A starting point for curious minds. Learn the language, find a place
          to practise, and make your findings useful to someone else.
        </p>
        <p className={styles.independent}>
          An independent resource from NestCipher. Gray Swan and the other
          projects below are separate organisations.
        </p>
      </header>

      <section className={styles.workflow} aria-labelledby="workflow-heading">
        <div className={styles.sectionBar}>
          <p className="eyebrow">01 / A research workflow</p>
          <span aria-hidden="true">Question → Test → Record ↻</span>
        </div>
        <div className={styles.sectionIntro}>
          <h2 id="workflow-heading">
            Make every attempt
            <br />
            teach you something.
          </h2>
          <p>
            Start with a question. Keep the evidence. Change one variable at a
            time.
          </p>
        </div>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNumber} aria-hidden="true">
              01
            </span>
            <div>
              <h3>Understand the failure mode.</h3>
              <p>
                Pick a risk and learn what success or failure looks like. Our
                OWASP explorer connects the definitions with examples and
                mitigations.
              </p>
              <Link href="/tools/owasp-llm-top-10" className="text-link">
                Open the OWASP explorer <ArrowIcon />
              </Link>
            </div>
          </li>
          <li>
            <span className={styles.stepNumber} aria-hidden="true">
              02
            </span>
            <div>
              <h3>Choose a scoped challenge.</h3>
              <p>
                Find a suitable Arena challenge, read its rules, and note the
                target behaviour. Establish a baseline before testing your
                hypothesis.
              </p>
              <a
                href="https://app.grayswan.ai/arena"
                className="text-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore Gray Swan Arena <ArrowIcon diagonal />
              </a>
            </div>
          </li>
          <li>
            <span className={styles.stepNumber} aria-hidden="true">
              03
            </span>
            <div>
              <h3>Document the observation.</h3>
              <p>
                Record the exact input, output and test conditions. Repeat the
                attempt and distinguish a reproducible failure from a one-off
                response.
              </p>
              <a href="/tools/research-workbench" className="text-link">
                Open the Research Workbench <ArrowIcon />
              </a>
              <a href="#research-notes" className="text-link">
                Use the notes checklist <ArrowIcon />
              </a>
            </div>
          </li>
        </ol>
        <p className={styles.loopNote}>
          <span>Repeat the loop ↻</span> Keep the scope, change one variable,
          and compare with your baseline.
        </p>
      </section>

      <section className={styles.practice} aria-labelledby="practice-heading">
        <div className={styles.sectionBar}>
          <p className="eyebrow">02 / Practise with known evidence</p>
          <span>AUTHORED EXERCISES / VERSION 1</span>
        </div>
        <div className={styles.sectionIntro}>
          <h2 id="practice-heading">Read the record.<br />Question the conclusion.</h2>
          <p>
            Work through invented cases with inspectable evidence and written
            explanations. Then prepare an untested, private experiment in the
            Workbench. No model or tools run in these labs.
          </p>
        </div>
        <div className={styles.practiceRows}>
          {researchLabs.map((lab) => (
            <Link key={lab.id} href={`/labs/${lab.id}`}>
              <span className={styles.practiceNumber}>{lab.ordinal}</span>
              <div><h3>{lab.title}</h3><p>{lab.summary}</p></div>
              <ArrowIcon diagonal />
            </Link>
          ))}
        </div>
      </section>

      <section
        id="research-notes"
        className={styles.notes}
        aria-labelledby="notes-heading"
      >
        <div className={styles.notesIntro}>
          <p className="eyebrow">03 / Keep a useful record</p>
          <h2 id="notes-heading">
            A finding is more
            <br />
            than a screenshot.
          </h2>
          <p>
            A simple record makes an experiment easier to reproduce, compare and
            explain.
          </p>
        </div>
        <div className={styles.noteTemplate}>
          <div className={styles.templateHeader}>
            <span>RESEARCH NOTES</span>
            <span>PLAIN-TEXT CHECKLIST</span>
          </div>
          <dl>
            <div>
              <dt>target</dt>
              <dd>Model, version, date and permitted scope</dd>
            </div>
            <div>
              <dt>hypothesis</dt>
              <dd>The specific behaviour you are testing</dd>
            </div>
            <div>
              <dt>input</dt>
              <dd>Exact prompt and relevant context</dd>
            </div>
            <div>
              <dt>observation</dt>
              <dd>Actual response, proposed actions and completed effects</dd>
            </div>
            <div>
              <dt>reproduction</dt>
              <dd>Attempts, conditions and repeatability</dd>
            </div>
            <div>
              <dt>impact</dt>
              <dd>Why the observed failure matters</dd>
            </div>
          </dl>
        </div>
      </section>

      <aside className={styles.privateNote} aria-label="Private research policy">
        <span className="eyebrow">Keep challenge findings private</span>
        <p>
          NestCipher follows a minimum restriction of 30 full days after a
          challenge&apos;s confirmed end before disclosing how it was broken.
          An unknown end stays restricted. A date never publishes a note or
          grants permission; follow any additional challenge rules. The
          Workbench exports private records with <code>publish: false</code>.
        </p>
      </aside>

      <section className={styles.resources} aria-labelledby="resources-heading">
        <div className={styles.resourcesHeader}>
          <div>
            <p className="eyebrow">04 / Outside the nest</p>
            <h2 id="resources-heading">
              Good places
              <br />
              to go deeper.
            </h2>
          </div>
          <span>EXTERNAL RESOURCES ↗</span>
        </div>
        <div className={styles.resourceRows}>
          {resources.map((resource) => (
            <a
              key={resource.title}
              href={resource.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div>
                <span>{resource.category}</span>
                <h3>{resource.title}</h3>
                <small>{resource.source}</small>
              </div>
              <p>{resource.description}</p>
              <ArrowIcon diagonal />
            </a>
          ))}
        </div>
        <p className={styles.resourceNote}>
          These resources open on their own websites. Challenge availability and
          access are managed by their respective providers.
        </p>
      </section>
      <section className={styles.contribute} aria-labelledby="contribute-heading">
        <div className={styles.sectionBar}>
          <p className="eyebrow">05 / Build the field guide</p>
          <span>PUBLIC TEACHING MATERIAL</span>
        </div>
        <div className={styles.sectionIntro}>
          <h2 id="contribute-heading">Teach a lesson.<br />Show your reasoning.</h2>
          <p>
            A useful contribution starts with an invented example, a precise
            question and evidence someone else can inspect. Use the template
            to prepare a teaching proposal for maintainer review.
          </p>
        </div>
        <ol className={styles.contributionChecks}>
          <li><span>01</span><p><strong>Invent the scenario.</strong> Use made-up tasks, records and recipients. Leave private prompts, transcripts and challenge techniques out.</p></li>
          <li><span>02</span><p><strong>Expose the evidence.</strong> Distinguish a reply, a proposed action and a completed effect. State what remains unknown.</p></li>
          <li><span>03</span><p><strong>Explain the answer.</strong> Include a counterexample, the limits of the conclusion and a primary reference.</p></li>
        </ol>
        <a href="/templates/nestcipher-lab-contribution.md" download className="button-secondary">
          Download the lab proposal template <ArrowIcon />
        </a>
        <p className={styles.resourceNote}>
          A Markdown template to work on locally. This site does not accept or
          publish submissions. These lessons are reviewed as authored teaching
          examples, not measurements of a model&apos;s behaviour.
        </p>
      </section>
      <div className={styles.feedback}>
        <p>Something missing from your research workflow?</p>
        <a href="mailto:hello@nestcipher.com" className="text-link">
          Suggest a tool or resource <ArrowIcon diagonal />
        </a>
      </div>
    </div>
  );
}
