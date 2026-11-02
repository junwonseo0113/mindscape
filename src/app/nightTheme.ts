/** Shared stargazing palette: solid reading surfaces, warm actions, colored data. */
export const night = {
  background: "#08131c",
  backgroundMid: "#0b182b",
  backgroundTop: "#142943",
  surface: "#102031",
  surfaceRaised: "#172b40",
  text: "#fff0d8",
  body: "#c2ceda",
  muted: "#aebed1",
  gold: "#ecd2a8",
  goldHover: "#ffe8c1",
  goldSoft: "rgba(236,210,168,0.12)",
  border: "rgba(236,210,168,0.22)",
  warning: "#f1b58d",
  danger: "#f4a6a1",
  shadow: "0 10px 30px rgba(0,0,0,0.2)",
} as const;

export const nightBackground = {
  backgroundColor: night.background,
  backgroundImage: `radial-gradient(ellipse at 60% 0%, ${night.backgroundTop} 0%, ${night.backgroundMid} 48%, ${night.background} 100%)`,
};
