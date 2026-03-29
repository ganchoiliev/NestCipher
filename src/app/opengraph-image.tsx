import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Nest Cipher — Free AI-Powered Security Tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A0A12",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontSize: 72, fontWeight: 700, color: "#F1F1F3" }}>
            NEST
          </span>
          <span style={{ fontSize: 72, fontWeight: 300, color: "#F1F1F3" }}>
            CIPHER
          </span>
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#00D4AA",
            marginTop: 20,
          }}
        >
          Free AI-Powered Security Tools
        </div>
        <div
          style={{
            width: 400,
            height: 1,
            backgroundColor: "#00D4AA",
            opacity: 0.3,
            marginTop: 30,
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: 40,
            color: "#6B7280",
            fontSize: 14,
          }}
        >
          <span>Email Analyzer</span>
          <span>Headers Scanner</span>
          <span>OWASP Top 10</span>
          <span>Injection Tester</span>
          <span>Content Detector</span>
          <span>Bias Checker</span>
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#6B7280",
            marginTop: 50,
          }}
        >
          nestcipher.com
        </div>
      </div>
    ),
    { ...size }
  );
}
