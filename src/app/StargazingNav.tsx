import { House, Orbit, ChartNoAxesColumn, BookOpen } from "lucide-react";

export default function StargazingNav({active, onSelect}: {active: string; onSelect?: (id: string) => void}) {
  const items = [
    {id: "home", label: "Home", Icon: House},
    {id: "analysis", label: "Mind", Icon: Orbit},
    {id: "discoveryAnalysis", label: "Analysis", Icon: ChartNoAxesColumn},
    {id: "history", label: "Journal", Icon: BookOpen},
  ];
  return <nav className="night-nav" aria-label="Main navigation">{items.map(({id, label, Icon}) =>
    <button key={id} aria-current={id === active ? "page" : undefined} data-tutorial={`nav-${id}`} onClick={() => onSelect?.(id)}>
      <Icon size={19} strokeWidth={1.6}/><span>{label}</span>
    </button>
  )}</nav>;
}
