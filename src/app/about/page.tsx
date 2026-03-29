"use client";

import { motion } from "framer-motion";

const techStack = [
  "Next.js",
  "TypeScript",
  "Tailwind CSS",
  "Vercel",
  "OpenAI",
  "Framer Motion",
  "GSAP",
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Mission */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-mono text-3xl font-bold sm:text-4xl">About Nest Cipher</h1>
        <div className="mt-6 space-y-4 text-text-secondary leading-relaxed">
          <p>
            Nest Cipher is a free, open security toolkit built to make AI-powered cybersecurity
            accessible to everyone. We believe developers and security professionals deserve
            fast, reliable tools without paywalls or sign-up walls.
          </p>
          <p>
            From email threat analysis to security header scanning, every tool is designed to
            give you actionable insights in seconds — not hours.
          </p>
        </div>
      </motion.section>

      {/* Who */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-16"
      >
        <h2 className="font-mono text-2xl font-bold">Who&apos;s behind this</h2>
        <p className="mt-4 text-text-secondary leading-relaxed">
          I&apos;m Gancho — a web developer and cybersecurity enthusiast based in Surrey, UK.
          I built Nest Cipher because I wanted free, well-designed security tools that don&apos;t
          gate useful functionality behind sign-ups or paywalls. Every tool here is something
          I&apos;d actually use myself.
        </p>
      </motion.section>

      {/* Contact */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="mt-16"
      >
        <h2 className="font-mono text-2xl font-bold">Get in touch</h2>
        <p className="mt-4 text-text-secondary leading-relaxed">
          Got feedback, ideas, or just want to say hi? Reach out at{" "}
          <a href="mailto:hello@nestcipher.com" className="text-accent hover:underline">
            hello@nestcipher.com
          </a>
        </p>
      </motion.section>

      {/* Tech stack */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-16"
      >
        <h2 className="font-mono text-2xl font-bold">Built with</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {techStack.map((tech) => (
            <span
              key={tech}
              className="rounded-full border border-border-subtle bg-bg-elevated px-4 py-2 text-sm font-medium text-text-secondary"
            >
              {tech}
            </span>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
