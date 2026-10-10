import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt =
  "NestCipher — Look closer. Free tools for security research.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const displayFont = await readFile(
    join(process.cwd(), "src/assets/BarlowCondensed-Bold.ttf"),
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0b100d",
          color: "#f0f3e9",
          padding: "44px 64px",
          fontFamily: "Signal",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #354336",
            paddingBottom: 20,
          }}
        >
          <span style={{ fontSize: 40 }}>
            NESTCIPHER<span style={{ color: "#c7ff48" }}>/</span>
          </span>
          <span style={{ fontSize: 22, color: "#acb6a8" }}>
            INDEPENDENT TOOLS / OPEN ACCESS
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 144,
              lineHeight: 0.85,
              letterSpacing: -3,
            }}
          >
            <span>LOOK</span>
            <span style={{ color: "#c7ff48" }}>CLOSER.</span>
          </div>
          <svg width="310" height="310" viewBox="0 0 480 480" fill="none">
            <g stroke="#c7ff48" strokeWidth="20">
              <path d="M32 218V32H448V448H32V284" />
              <path d="M82 218V82H398V398H82V284" />
              <path d="M132 218V132H348V348H132V284" />
              <path d="M182 218V182H298V298H182V284" />
            </g>
            <path
              d="M0 250H250m-22-21 22 21-22 21"
              stroke="#c7ff48"
              strokeWidth="8"
            />
          </svg>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #354336",
            paddingTop: 20,
            color: "#acb6a8",
            fontSize: 24,
          }}
        >
          <span>EMAIL ANALYSIS / SECURITY HEADERS / LLM RISKS</span>
          <span>nestcipher.com</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Signal", data: displayFont, weight: 700, style: "normal" },
      ],
    },
  );
}
