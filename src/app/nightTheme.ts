/** Shared stargazing palette: solid reading surfaces, warm actions, colored data. */
export const night = {
  background: "#08131c",
  backgroundMid: "#0b182b",
  backgroundTop: "#142943",
  surface: "#102031",
  surfaceRaised: "#172b40",
  text: "#fff0d8",
  body: "#c7cdd2",
  muted: "#aeb9c2",
  gold: "#ecd2a8",
  goldHover: "#ffe8c1",
  goldSoft: "rgba(236,210,168,0.12)",
  border: "rgba(212,221,225,0.14)",
  warning: "#f1b58d",
  danger: "#f4a6a1",
  shadow: "none",
} as const;

export const nightBackground = {
  backgroundColor: night.background,
  backgroundImage: `radial-gradient(ellipse at 60% 0%, ${night.backgroundTop} 0%, ${night.backgroundMid} 48%, ${night.background} 100%)`,
};
