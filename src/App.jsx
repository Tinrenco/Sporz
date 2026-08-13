import { useState, useRef, useMemo, useEffect } from "react";
import {
  Skull, Stethoscope, Brain, Cpu, Terminal, Eye, User,
  VenetianMask, Rocket, BookOpen, ChevronLeft, Minus, Plus,
  Users, Syringe, Heart, X, Check, Trophy, Ban,
  Clock, Pause, Play, Crown, Shuffle,
} from "lucide-react";

/* ---------------------------------------------------------
   DONNÉES DE JEU
--------------------------------------------------------- */

const ROLES_BASE = [
  "Mutant souche",
  "Médecin",
  "Médecin",
  "Psychologue",
  "Informaticien",
  "Hacker",
];

const ROLE_INFO = {
  "Mutant souche": { icon: Skull, color: "#ff4d5e", glow: "rgba(255,77,94,0.45)", desc: "Premier mutant. Désigne chaque nuit, avec les autres mutants, une personne à muter et une à paralyser. Si la souche meurt, les autres mutants continuent d'agir." },
  "Médecin": { icon: Stethoscope, color: "#5ee0c8", glow: "rgba(94,224,200,0.45)", desc: "Soigne une personne chaque nuit (ou peut tuer). Les deux médecins se reconnaissent avant la première nuit." },
  "Psychologue": { icon: Brain, color: "#b389ff", glow: "rgba(179,137,255,0.45)", desc: "Connaît l'état d'une personne : mutante ou saine." },
  "Informaticien": { icon: Cpu, color: "#5ea9ff", glow: "rgba(94,169,255,0.45)", desc: "Connaît le nombre de mutants à bord." },
  "Hacker": { icon: Terminal, color: "#8dff6b", glow: "rgba(141,255,107,0.45)", desc: "Peut voler l'information d'un autre rôle." },
  "Espion": { icon: Eye, color: "#c9c9c9", glow: "rgba(201,201,201,0.4)", desc: "Sait ce qui est arrivé à quelqu'un pendant la nuit." },
  "Traître": { icon: VenetianMask, color: "#ffb454", glow: "rgba(255,180,84,0.45)", desc: "Sain, mais joue pour le camp des mutants." },
  "Astronaute": { icon: User, color: "#e8e8e8", glow: "rgba(232,232,232,0.35)", desc: "Aucune capacité particulière. Reste vigilant." },
};

// Ordre des rôles à réveil individuel (le réveil des mutants est géré séparément, en premier)
const ROLE_TURN_ORDER_REST = ["Médecin", "Informaticien", "Psychologue", "Espion", "Hacker"];

const RULES_SECTIONS = [
  { title: "But du jeu", body: "Sporz Original Outbreak est un jeu de société dans lequel chaque joueur incarne un astronaute, sain ou muté par une spore qui s'empare de l'esprit de son hôte.\n\nPour les astronautes sains : tuer ou guérir tous les mutés.\nPour les astronautes mutés : muter ou tuer tous les astronautes sains." },
  { title: "Les rôles", roles: true },
  { title: "Déroulement", body: "La partie est menée par une personne ne prenant pas part au jeu (ou par l'application). Un rôle est distribué à chaque joueur, au hasard ou à son idée ; chacun découvre secrètement son identité.\n\nAvant la première nuit, les deux médecins se réveillent ensemble et se reconnaissent secrètement.\n\nDeux camps s'affrontent : les mutants et les astronautes sains. Chaque camp veut être l'unique camp à bord du vaisseau.\n\nLes tours sont rythmés par une période de jour et une de nuit. Durant la nuit, tous les joueurs ferment les yeux. Chaque rôle est appelé tour à tour par le meneur et effectue son action. Au matin, tout le monde se réveille." },
  { title: "Le jour", body: "Prévenus de la présence d'une spore, les non-mutants tentent de détecter qui est muté, sans se trahir. Les mutants tentent de se faire passer pour des gens sains. Pour éviter une propagation trop rapide, les joueurs ne peuvent pas se regrouper à plus de 4.\n\nLa discussion est chronométrée (durée réglable en début de partie). Lors du tout premier vote, l'équipage élit aussi un capitaine.\n\nÀ la fin du débat, chaque joueur vote en secret, avec possibilité de voter blanc. En cas de majorité de blancs, rien ne se passe. En cas d'égalité entre plusieurs joueurs, c'est le capitaine qui décide qui est éliminé. Sinon, la personne désignée est déclarée hors-jeu : son rôle et son état sont révélés." },
  { title: "L'essentiel", body: "Toute la subtilité du jeu réside dans l'observation, les tractations sociales entre joueurs, et le partage d'informations — certains rôles détenant des indices décisifs, ou pouvant semer le doute s'ils sont mutants." },
];

function generateRoles(n, opts = {}) {
  let roles = [...ROLES_BASE];
  const extra = Math.max(0, n - roles.length);
  let used = 0;
  if (opts.traitre && used < extra) { roles.push("Traître"); used++; }
  if (opts.espion && used < extra) { roles.push("Espion"); used++; }
  const astronautCount = Math.max(0, Math.min(opts.astronautes || 0, extra - used));
  for (let i = 0; i < astronautCount; i++) { roles.push("Astronaute"); used++; }
  while (roles.length < n) roles.push("Astronaute");
  return roles.sort(() => Math.random() - 0.5);
}

function checkWinner(players) {
  const alive = players.filter((p) => p.alive);
  if (alive.length === 0) return "aucun";
  const sains = alive.filter((p) => p.status === "sain");
  const mutants = alive.filter((p) => p.status === "mutant");
  if (mutants.length === 0) return "sains";
  if (sains.length === 0) return "mutants";
  return null;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ---------------------------------------------------------
   FOND COMMUN / PETITS COMPOSANTS
--------------------------------------------------------- */

function Backdrop({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh", width: "100%",
        background: "radial-gradient(circle at 50% 0%, #14202b 0%, #070b10 55%, #030405 100%)",
        color: "#e8ecef", fontFamily: "'Courier New', monospace",
        display: "flex", flexDirection: "column", alignItems: "center",
        position: "relative", overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px)" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 480, minHeight: "100vh", display: "flex", flexDirection: "column", padding: "28px 20px 90px" }}>
        {children}
      </div>
    </div>
  );
}

function BackButton({ onClick, label = "MENU" }) {
  return (
    <button onClick={onClick} style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 999, padding: "10px 22px", color: "#c9d3d8", fontFamily: "'Courier New', monospace", fontSize: 14, letterSpacing: 1, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", zIndex: 20 }}>
      <ChevronLeft size={16} /> {label}
    </button>
  );
}

function PrimaryButton({ children, onClick, icon: Icon, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 28px", borderRadius: 10, border: disabled ? "1px solid rgba(255,255,255,0.1)" : "1px solid #4fd67a", background: disabled ? "rgba(255,255,255,0.03)" : "linear-gradient(180deg, rgba(79,214,122,0.18), rgba(79,214,122,0.05))", color: disabled ? "#5c6a63" : "#a9ffb0", fontFamily: "'Courier New', monospace", fontSize: 15, fontWeight: 700, letterSpacing: 1, cursor: disabled ? "not-allowed" : "pointer", ...style }}>
      {Icon && <Icon size={17} />} {children}
    </button>
  );
}

function Chip({ label, sub, color, selected, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "8px 14px", borderRadius: 10, border: `1px solid ${selected ? color : "rgba(255,255,255,0.15)"}`, background: selected ? `${color}22` : "rgba(255,255,255,0.03)", color: disabled ? "#4a5551" : selected ? color : "#d5dadd", fontFamily: "'Courier New', monospace", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, textAlign: "left" }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
      {sub && <span style={{ fontSize: 10, opacity: 0.7 }}>{sub}</span>}
    </button>
  );
}

function SectionTitle({ icon: Icon, color, title, sub }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={16} color={color} />
        <h4 style={{ margin: 0, fontSize: 14, color, letterSpacing: 0.5 }}>{title.toUpperCase()}</h4>
      </div>
      {sub && <p style={{ fontSize: 11, color: "#7f9a8c", margin: "3px 0 0 24px" }}>{sub}</p>}
    </div>
  );
}

function CaptainBadge() {
  return <Crown size={12} color="#ffb454" style={{ marginLeft: 6, verticalAlign: "middle" }} />;
}

/* PlayersToggle : bouton "JOUEURS" (peut être désactivé, ex. pendant la phase de vote) */
function PlayersToggle({ players, disabled, captainId }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => { if (!disabled) setOpen(true); }}
        disabled={disabled}
        title={disabled ? "Indisponible pendant la phase de vote" : undefined}
        style={{
          position: "fixed", top: 18, right: 18,
          background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.18)"}`,
          borderRadius: 999, padding: "8px 14px",
          color: disabled ? "#3d4a44" : "#c9d3d8",
          fontFamily: "'Courier New', monospace", fontSize: 12, letterSpacing: 1,
          display: "flex", alignItems: "center", gap: 6,
          cursor: disabled ? "not-allowed" : "pointer", zIndex: 25,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Users size={14} /> JOUEURS
      </button>
      {open && !disabled && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,4,6,0.88)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, maxHeight: "80vh", overflowY: "auto", background: "#0c1116", border: "1px solid rgba(141,255,107,0.3)", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#8dff6b", fontSize: 16, letterSpacing: 1 }}>ASSOCIATION JOUEURS</h3>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#e8ecef", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 11, color: "#7f9a8c", marginTop: -8, marginBottom: 14 }}>Réservé au maître du jeu — mis à jour en direct</p>
            {players.map((p) => {
              const info = ROLE_INFO[p.role];
              const Icon = info.icon;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", opacity: p.alive ? 1 : 0.45 }}>
                  <Icon size={18} color={info.color} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e8ecef", textDecoration: p.alive ? "none" : "line-through" }}>
                      {p.name}{captainId === p.id && <CaptainBadge />}
                    </div>
                    <div style={{ fontSize: 12, color: info.color }}>{p.role}</div>
                  </div>
                  <span style={{ fontSize: 10, letterSpacing: 0.5, padding: "3px 8px", borderRadius: 999, color: p.status === "mutant" ? "#ff8f9a" : "#9fe8c8", border: `1px solid ${p.status === "mutant" ? "#ff4d5e" : "#4fd67a"}` }}>
                    {p.status === "mutant" ? "MUTANT" : "SAIN"}
                  </span>
                  {!p.alive && <span style={{ fontSize: 10, color: "#7f9a8c" }}>ÉLIMINÉ</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

const roundBtnStyle = { width: 52, height: 52, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "#e8ecef", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

/* ---------------------------------------------------------
   ECRAN : MENU
--------------------------------------------------------- */

function Menu({ setScreen }) {
  return (
    <Backdrop>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 6 }}>
        <Skull size={40} color="#8dff6b" style={{ filter: "drop-shadow(0 0 12px rgba(141,255,107,0.55))", marginBottom: 6 }} />
        <h1 style={{ fontSize: 54, fontWeight: 900, letterSpacing: 4, margin: 0, background: "linear-gradient(180deg, #a9ffb0 0%, #4fd67a 60%, #1f8a4c 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "0 0 30px rgba(141,255,107,0.25)" }}>SPORZ</h1>
        <p style={{ color: "#7f9a8c", letterSpacing: 3, fontSize: 13, marginTop: -6, textTransform: "uppercase" }}>Souchasse Outbreak</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 60 }}>
        <button onClick={() => setScreen("playerSelect")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 24px", borderRadius: 10, border: "1px solid #4fd67a", background: "linear-gradient(180deg, rgba(79,214,122,0.18), rgba(79,214,122,0.05))", color: "#a9ffb0", fontFamily: "'Courier New', monospace", fontSize: 16, fontWeight: 700, letterSpacing: 1, cursor: "pointer", boxShadow: "0 0 20px rgba(79,214,122,0.15)" }}>
          <Rocket size={18} /> COMMENCER UNE PARTIE
        </button>
        <button onClick={() => setScreen("rules")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "#d5dadd", fontFamily: "'Courier New', monospace", fontSize: 16, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>
          <BookOpen size={18} /> RÈGLES DU JEU
        </button>
      </div>
    </Backdrop>
  );
}

/* ---------------------------------------------------------
   ECRAN : SELECTION JOUEURS
--------------------------------------------------------- */

function PlayerSelect({
  numPlayers, setNumPlayers,
  includeTraitre, setIncludeTraitre,
  includeEspion, setIncludeEspion,
  astronautCount, setAstronautCount,
  discussionMinutes, setDiscussionMinutes,
  onValidate, setScreen,
}) {
  const [error, setError] = useState("");
  const extraSlots = Math.max(0, numPlayers - 6);
  const specialCount = (includeTraitre ? 1 : 0) + (includeEspion ? 1 : 0);
  const remainingForAstronautes = Math.max(0, extraSlots - specialCount);
  const astronautDisplay = Math.min(astronautCount, remainingForAstronautes);

  return (
    <Backdrop>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 22, paddingTop: 30, paddingBottom: 30, overflowY: "auto" }}>
        <p style={{ color: "#9fb3ac", letterSpacing: 1, fontSize: 15 }}>NOMBRE DE JOUEURS (6 MINIMUM)</p>
        <div style={{ fontSize: 64, fontWeight: 900, color: "#8dff6b", textShadow: "0 0 30px rgba(141,255,107,0.4)", minWidth: 120, textAlign: "center" }}>{numPlayers}</div>
        <div style={{ display: "flex", gap: 20 }}>
          <button onClick={() => setNumPlayers((n) => Math.max(6, n - 1))} style={roundBtnStyle}><Minus size={22} /></button>
          <button onClick={() => setNumPlayers((n) => Math.min(20, n + 1))} style={roundBtnStyle}><Plus size={22} /></button>
        </div>

        {extraSlots > 0 && (
          <div style={{ width: "100%" }}>
            <SectionTitle icon={VenetianMask} color="#ffb454" title="Rôles additionnels" sub={`${extraSlots} place(s) en plus des 6 rôles de base. Les places non attribuées deviennent des Astronautes.`} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 2 }}>
              <Chip
                label="Traître" sub="Sain, camp des mutants" color="#ffb454"
                selected={includeTraitre}
                disabled={!includeTraitre && specialCount >= extraSlots}
                onClick={() => setIncludeTraitre((v) => !v)}
              />
              <Chip
                label="Espion" sub="Infos sur la nuit" color="#c9c9c9"
                selected={includeEspion}
                disabled={!includeEspion && specialCount >= extraSlots}
                onClick={() => setIncludeEspion((v) => !v)}
              />
            </div>
            {remainingForAstronautes > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 12 }}>
                <span style={{ fontSize: 13, color: "#d5dadd" }}>Astronaute(s) additionnel(s)</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => setAstronautCount((c) => Math.max(0, Math.min(c, remainingForAstronautes) - 1))} style={{ ...roundBtnStyle, width: 32, height: 32 }}><Minus size={14} /></button>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#e8e8e8", minWidth: 18, textAlign: "center" }}>{astronautDisplay}</div>
                  <button onClick={() => setAstronautCount((c) => Math.min(remainingForAstronautes, c + 1))} disabled={astronautDisplay >= remainingForAstronautes} style={{ ...roundBtnStyle, width: 32, height: 32 }}><Plus size={14} /></button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ width: "100%" }}>
          <SectionTitle icon={Clock} color="#5ea9ff" title="Chrono de discussion" sub="Durée du débat avant chaque vote." />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <button onClick={() => setDiscussionMinutes((m) => Math.max(1, m - 1))} style={{ ...roundBtnStyle, width: 40, height: 40 }}><Minus size={16} /></button>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#5ea9ff", minWidth: 70, textAlign: "center" }}>{discussionMinutes} min</div>
            <button onClick={() => setDiscussionMinutes((m) => Math.min(30, m + 1))} style={{ ...roundBtnStyle, width: 40, height: 40 }}><Plus size={16} /></button>
          </div>
        </div>

        {error && <p style={{ color: "#ff4d5e", fontSize: 13 }}>{error}</p>}
        <PrimaryButton onClick={() => { if (numPlayers < 6) { setError("Il faut au moins 6 joueurs !"); return; } onValidate(numPlayers); }}>VALIDER</PrimaryButton>
      </div>
      <BackButton onClick={() => setScreen("menu")} />
    </Backdrop>
  );
}

/* ---------------------------------------------------------
   ECRAN : DISTRIBUTION DES ROLES (+ prénom)
--------------------------------------------------------- */

function RoleCard({ role, revealed }) {
  const info = role ? ROLE_INFO[role] : null;
  const Icon = info?.icon;
  return (
    <div style={{ width: "100%", maxWidth: 260, aspectRatio: "3 / 4", borderRadius: 18, perspective: 1000 }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 18, position: "relative", transition: "transform 0.5s cubic-bezier(.4,.2,.2,1)", transformStyle: "preserve-3d", transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 18, backfaceVisibility: "hidden", background: "linear-gradient(155deg, #10161c 0%, #0a0e12 100%)", border: "1px solid rgba(141,255,107,0.25)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 30px rgba(0,0,0,0.5)" }}>
          <Skull size={54} color="#2c4a38" />
        </div>
        <div style={{ position: "absolute", inset: 0, borderRadius: 18, backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: info ? `linear-gradient(155deg, ${info.color}22 0%, #0a0e12 75%)` : "#0a0e12", border: `1px solid ${info ? info.color + "88" : "rgba(255,255,255,0.2)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 18, boxShadow: info ? `0 0 40px ${info.glow}` : "none" }}>
          {Icon && <Icon size={64} color={info.color} style={{ filter: `drop-shadow(0 0 14px ${info.glow})` }} />}
          {role && <div style={{ fontSize: 20, fontWeight: 800, color: info.color, textAlign: "center", letterSpacing: 0.5 }}>{role.toUpperCase()}</div>}
        </div>
      </div>
    </div>
  );
}

// Durée de l'animation de retournement de la carte (doit matcher la transition CSS de RoleCard)
const FLIP_DURATION_MS = 520;

function RolePhase({ roles, onFinish, setScreen }) {
  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [players, setPlayers] = useState([]);
  const [finished, setFinished] = useState(false);
  // Empêche de changer de joueur/rôle tant que l'animation de retournement n'est pas terminée,
  // ce qui évite d'entrevoir la couleur du rôle suivant pendant que la carte se retourne.
  const [transitioning, setTransitioning] = useState(false);

  const currentRole = roles[index];

  const handlePrimaryAction = () => {
    if (transitioning) return;
    if (!revealed) {
      if (!name.trim()) return;
      setRevealed(true);
    } else {
      // On lance d'abord l'animation de retournement (retour à la face cachée)...
      setTransitioning(true);
      setRevealed(false);
      // ...et on ne change de joueur/rôle qu'une fois la carte totalement retournée.
      setTimeout(() => {
        const status = currentRole === "Mutant souche" ? "mutant" : "sain";
        setPlayers((prev) => [...prev, { id: index, name: name.trim(), role: currentRole, status, alive: true }]);
        setName("");
        if (index + 1 >= roles.length) setFinished(true);
        else setIndex((i) => i + 1);
        setTransitioning(false);
      }, FLIP_DURATION_MS);
    }
  };

  if (finished) {
    return (
      <Backdrop>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 26 }}>
          <Rocket size={48} color="#8dff6b" />
          <h2 style={{ fontSize: 26, letterSpacing: 1, color: "#e8ecef", margin: 0 }}>C'est parti ! 🚀</h2>
          <PrimaryButton onClick={() => onFinish(players)}>LANCER LA PARTIE</PrimaryButton>
        </div>
        <BackButton onClick={() => setScreen("menu")} />
      </Backdrop>
    );
  }

  return (
    <Backdrop>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 20 }}>
        <p style={{ fontSize: 12, color: "#7f9a8c", letterSpacing: 2 }}>JOUEUR {index + 1} / {roles.length}</p>
        {!revealed && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" autoFocus disabled={transitioning} style={{ width: "100%", maxWidth: 260, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "#e8ecef", fontFamily: "'Courier New', monospace", fontSize: 16, textAlign: "center", outline: "none" }} />
        )}
        <RoleCard role={currentRole} revealed={revealed} />
        <div style={{ height: 40, display: "flex", alignItems: "center" }}>
          {revealed && <p style={{ fontSize: 16, fontWeight: 700, color: "#e8ecef", textAlign: "center", margin: 0 }}>{name}, vous êtes : {currentRole}</p>}
        </div>
        <PrimaryButton onClick={handlePrimaryAction} disabled={(!revealed && !name.trim()) || transitioning}>
          {revealed ? "MASQUER VOTRE RÔLE" : "RÉVÉLER VOTRE RÔLE"}
        </PrimaryButton>
        <p style={{ fontSize: 12, color: "#7f9a8c", textAlign: "center", maxWidth: 260, fontWeight: 700 }}>
          {revealed ? "Cliquez pour masquer votre rôle et passer au joueur suivant." : "Entrez votre prénom pour pouvoir révéler votre rôle."}
        </p>
      </div>
      <BackButton onClick={() => setScreen("menu")} />
    </Backdrop>
  );
}

/* ---------------------------------------------------------
   ECRAN : RECONNAISSANCE DES MÉDECINS (avant la 1ère nuit)
--------------------------------------------------------- */

function MedecinReco({ players, onContinue, setScreen }) {
  const medecins = players.filter((p) => p.role === "Médecin");
  return (
    <Backdrop>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 24, textAlign: "center" }}>
        <Stethoscope size={44} color="#5ee0c8" style={{ filter: "drop-shadow(0 0 14px rgba(94,224,200,0.5))" }} />
        {medecins.length === 2 ? (
          <PhaseText
            title="Avant la première nuit, les deux médecins se réveillent..."
            sub={`${medecins[0].name} et ${medecins[1].name}, ouvrez les yeux et regardez-vous.\nVous connaissez désormais l'identité l'un de l'autre.`}
            highlight
          />
        ) : (
          <PhaseText title="Il n'y a qu'un seul médecin en jeu." sub="Rien à faire pour cette étape." />
        )}
        <PrimaryButton onClick={onContinue}>LES MÉDECINS SE RENDORMENT</PrimaryButton>
      </div>
      <BackButton onClick={() => setScreen("menu")} />
    </Backdrop>
  );
}

/* ---------------------------------------------------------
   ECRAN : NUIT INTERACTIVE
--------------------------------------------------------- */

function NightGame({ round, players, captainId, onComplete, onAutoEnd, setScreen }) {
  // copie de travail des joueurs, mise à jour en direct pendant la nuit
  const [workingPlayers, setWorkingPlayers] = useState(() => players.map((p) => ({ ...p })));
  const [stepIndex, setStepIndex] = useState(0);

  const [mutateId, setMutateId] = useState(null);
  const [paralyzeId, setParalyzeId] = useState(null);
  const [healedIds, setHealedIds] = useState(new Set());
  const [psychoTargetId, setPsychoTargetId] = useState(null);
  const [espionTargetId, setEspionTargetId] = useState(null);
  const [hackedRole, setHackedRole] = useState(null);

  // phases actives cette nuit : le réveil des mutants (souche + mutants convertis, tant qu'il en reste
  // un en vie, même si la souche est morte), puis les rôles à réveil individuel encore vivants.
  const phases = useMemo(() => {
    const aliveMutants = players.filter((p) => p.alive && p.status === "mutant");
    const mutantPhase = aliveMutants.length > 0 ? { role: "Mutants", actors: aliveMutants } : null;
    const rolePhases = ROLE_TURN_ORDER_REST
      .map((role) => ({ role, actors: players.filter((p) => p.role === role && p.alive) }))
      .filter((ph) => ph.actors.length > 0);
    return mutantPhase ? [mutantPhase, ...rolePhases] : rolePhases;
  }, [players]);

  const steps = useMemo(() => ["intro", ...phases.map((ph) => ph.role), "outro"], [phases]);
  const currentKey = steps[stepIndex];

  const getPlayer = (id) => workingPlayers.find((p) => p.id === id);

  // Une personne ne peut pas "se réveiller" (agir) si elle est paralysée,
  // ou si elle a été mutée cette nuit et n'a pas encore été soignée.
  const isIncapacitated = (id) => id === paralyzeId || (id === mutateId && !healedIds.has(id));
  const incapacityLabel = (id) => {
    if (id === paralyzeId && id === mutateId && !healedIds.has(id)) return "paralysée et mutée cette nuit";
    if (id === paralyzeId) return "paralysée";
    if (id === mutateId && !healedIds.has(id)) return "mutée cette nuit et n'a pas été soignée à temps";
    return null;
  };

  const goNext = () => {
    if (stepIndex >= steps.length - 1) {
      onComplete(workingPlayers);
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  const confirmMutantPhase = () => {
    let updated = workingPlayers;
    if (mutateId !== null) {
      updated = workingPlayers.map((p) => (p.id === mutateId ? { ...p, status: "mutant" } : p));
      setWorkingPlayers(updated);
    }

    // Fin de partie automatique : si les deux médecins sont hors service (mutés, ou l'un muté
    // et l'autre paralysé cette nuit), plus personne ne peut soigner — la partie s'arrête.
    const medecins = updated.filter((p) => p.role === "Médecin");
    const bothAlive = medecins.length === 2 && medecins.every((p) => p.alive);
    if (bothAlive) {
      const mutantCount = medecins.filter((p) => p.status === "mutant").length;
      const oneMutantOneParalyzed = mutantCount === 1 && medecins.some((p) => p.status === "sain" && p.id === paralyzeId);
      if (mutantCount === 2 || oneMutantOneParalyzed) {
        onAutoEnd(updated);
        return;
      }
    }

    goNext();
  };

  const confirmMedecinPhase = () => {
    if (healedIds.size > 0) {
      setWorkingPlayers((prev) => prev.map((p) => (healedIds.has(p.id) ? { ...p, status: "sain" } : p)));
    }
    goNext();
  };

  /* --------- rendu par phase --------- */

  let content = null;

  if (currentKey === "intro") {
    content = (
      <PhaseText title="Tous les membres du vaisseau s'endorment..." />
    );
  } else if (currentKey === "outro") {
    content = (
      <PhaseText title="Tous les membres du vaisseau se réveillent..." />
    );
  } else {
    const phase = phases.find((ph) => ph.role === currentKey);

    if (currentKey === "Mutants") {
      const sains = workingPlayers.filter((p) => p.alive && p.status === "sain");
      const paralyzables = workingPlayers.filter((p) => p.alive && p.status !== "mutant");
      const title = round === 1 ? "Le mutant souche se réveille..." : "Les mutants se réveillent...";
      const sub = round === 1
        ? "Il désigne une personne à muter et une personne à paralyser."
        : "Ils désignent, ensemble, une personne à muter et une personne à paralyser.";
      content = (
        <>
          <PhaseText title={title} sub={sub} />
          <SelectorBlock icon={Syringe} color="#ff4d5e" label="Personne à muter">
            <Chip label="Personne" color="#ff4d5e" selected={mutateId === null} onClick={() => setMutateId(null)} />
            {sains.map((p) => <Chip key={p.id} label={p.name} sub={p.role} color="#ff4d5e" selected={mutateId === p.id} onClick={() => setMutateId(p.id)} />)}
          </SelectorBlock>
          <SelectorBlock icon={Ban} color="#ffb454" label="Personne à paralyser">
            <Chip label="Personne" color="#ffb454" selected={paralyzeId === null} onClick={() => setParalyzeId(null)} />
            {paralyzables.map((p) => <Chip key={p.id} label={p.name} sub={p.role} color="#ffb454" selected={paralyzeId === p.id} onClick={() => setParalyzeId(p.id)} />)}
          </SelectorBlock>
        </>
      );
    }

    if (currentKey === "Médecin") {
      const actorsAll = phase.actors;
      const activeMedecins = actorsAll.filter((a) => !isIncapacitated(a.id));
      if (activeMedecins.length === 0) {
        const reason = actorsAll.map((a) => incapacityLabel(a.id)).find(Boolean) || "indisponible";
        content = <PhaseText title="Les médecins se réveillent..." sub={`Le médecin est ${reason}, donc il n'a pas accès à son action.`} paralyzed />;
      } else {
        const healCap = activeMedecins.length;
        const healable = workingPlayers.filter((p) => p.alive && p.status === "mutant" && p.role !== "Mutant souche");
        content = (
          <>
            <PhaseText
              title="Les médecins se réveillent..."
              sub={actorsAll.length > activeMedecins.length ? "Un médecin est indisponible (paralysé ou muté) et ne participe pas cette nuit." : `Ils désignent, ensemble, jusqu'à ${healCap} personne(s) à soigner (y compris une personne mutée cette nuit).`}
            />
            <SelectorBlock icon={Heart} color="#5ee0c8" label={`Personnes soignées (${healedIds.size}/${healCap})`}>
              {healable.length === 0 && <p style={{ fontSize: 12, color: "#7f9a8c" }}>Aucune personne mutante à soigner pour l'instant.</p>}
              {healable.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  sub={p.role}
                  color="#5ee0c8"
                  selected={healedIds.has(p.id)}
                  disabled={!healedIds.has(p.id) && healedIds.size >= healCap}
                  onClick={() => {
                    const next = new Set(healedIds);
                    if (next.has(p.id)) next.delete(p.id);
                    else if (next.size < healCap) next.add(p.id);
                    setHealedIds(next);
                  }}
                />
              ))}
            </SelectorBlock>
          </>
        );
      }
    }

    if (currentKey === "Informaticien") {
      const actor = phase.actors[0];
      if (isIncapacitated(actor.id)) {
        content = <PhaseText title="L'informaticien se réveille..." sub={`L'informaticien est ${incapacityLabel(actor.id)}, donc il n'a pas accès à son information.`} paralyzed />;
      } else {
        const count = workingPlayers.filter((p) => p.alive && p.status === "mutant").length;
        content = <PhaseText title="L'informaticien se réveille..." sub={`Il y a ${count} mutant${count > 1 ? "s" : ""} à bord du vaisseau.`} highlight />;
      }
    }

    if (currentKey === "Psychologue") {
      const actor = phase.actors[0];
      if (isIncapacitated(actor.id)) {
        content = <PhaseText title="Le psychologue se réveille..." sub={`Le psychologue est ${incapacityLabel(actor.id)}, donc il n'a pas accès à son information.`} paralyzed />;
      } else {
        const candidates = workingPlayers.filter((p) => p.alive && p.id !== actor.id);
        const target = psychoTargetId !== null ? getPlayer(psychoTargetId) : null;
        content = (
          <>
            <PhaseText title="Le psychologue se réveille..." sub="Il désigne une personne à analyser." />
            <SelectorBlock icon={Brain} color="#b389ff" label="Personne analysée">
              {candidates.map((p) => <Chip key={p.id} label={p.name} sub={p.role} color="#b389ff" selected={psychoTargetId === p.id} onClick={() => setPsychoTargetId(p.id)} />)}
            </SelectorBlock>
            {target && (
              <ResultBox color={target.status === "mutant" ? "#ff4d5e" : "#8dff6b"}>
                Cette personne est {target.status === "mutant" ? "MUTANTE" : "SAINE"}.
              </ResultBox>
            )}
          </>
        );
      }
    }

    if (currentKey === "Espion") {
      const actor = phase.actors[0];
      if (isIncapacitated(actor.id)) {
        content = <PhaseText title="L'espion se réveille..." sub={`L'espion est ${incapacityLabel(actor.id)}, donc il n'a pas accès à son information.`} paralyzed />;
      } else {
        const candidates = workingPlayers.filter((p) => p.alive && p.id !== actor.id);
        const target = espionTargetId !== null ? getPlayer(espionTargetId) : null;
        content = (
          <>
            <PhaseText title="L'espion se réveille..." sub="Il désigne une personne pour savoir ce qu'il lui est arrivé cette nuit." />
            <SelectorBlock icon={Eye} color="#c9c9c9" label="Personne observée">
              {candidates.map((p) => <Chip key={p.id} label={p.name} sub={p.role} color="#c9c9c9" selected={espionTargetId === p.id} onClick={() => setEspionTargetId(p.id)} />)}
            </SelectorBlock>
            {target && (
              <ResultBox color="#c9c9c9">
                Mutée : {mutateId === target.id ? "Oui" : "Non"}{"\n"}
                Paralysée : {paralyzeId === target.id ? "Oui" : "Non"}{"\n"}
                Soignée : {healedIds.has(target.id) ? "Oui" : "Non"}{"\n"}
                Analysée par le psychologue : {psychoTargetId === target.id ? "Oui" : "Non"}
              </ResultBox>
            )}
          </>
        );
      }
    }

    if (currentKey === "Hacker") {
      const actor = phase.actors[0];
      if (isIncapacitated(actor.id)) {
        content = <PhaseText title="Le hacker se réveille..." sub={`Le hacker est ${incapacityLabel(actor.id)}, donc il n'a pas accès à son information.`} paralyzed />;
      } else {
        const informaticienActor = phases.find((ph) => ph.role === "Informaticien")?.actors[0];
        const psychoActor = phases.find((ph) => ph.role === "Psychologue")?.actors[0];
        const espionActor = phases.find((ph) => ph.role === "Espion")?.actors[0];
        const infoParalyzed = informaticienActor ? isIncapacitated(informaticienActor.id) : false;
        const psychoParalyzed = psychoActor ? isIncapacitated(psychoActor.id) : false;
        const espionParalyzed = espionActor ? isIncapacitated(espionActor.id) : false;

        let eligibleRoles = ["Informaticien", "Psychologue", "Espion"].filter((r) => phases.some((ph) => ph.role === r));
        if (espionParalyzed) eligibleRoles = eligibleRoles.filter((r) => r !== "Espion");

        // Si l'informaticien ou le psychologue est paralysé, le hacker ne peut pas piocher son info :
        // il obtient à la place, automatiquement, l'information de l'autre rôle de la paire.
        let autoInfo = null;
        if (infoParalyzed) {
          eligibleRoles = eligibleRoles.filter((r) => r !== "Informaticien");
          if (psychoActor && !psychoParalyzed) {
            eligibleRoles = eligibleRoles.filter((r) => r !== "Psychologue");
            const target = psychoTargetId !== null ? getPlayer(psychoTargetId) : null;
            autoInfo = target ? `${target.name} est ${target.status === "mutant" ? "MUTANTE" : "SAINE"}.` : "Le psychologue n'a analysé personne cette nuit.";
          }
        }
        if (psychoParalyzed) {
          eligibleRoles = eligibleRoles.filter((r) => r !== "Psychologue");
          if (informaticienActor && !infoParalyzed) {
            eligibleRoles = eligibleRoles.filter((r) => r !== "Informaticien");
            const count = workingPlayers.filter((p) => p.alive && p.status === "mutant").length;
            autoInfo = `Il y a ${count} mutant${count > 1 ? "s" : ""} à bord du vaisseau.`;
          }
        }

        if (eligibleRoles.length === 0 && !autoInfo) {
          content = <PhaseText title="Le hacker se réveille..." sub="Aucune information à voler cette nuit." />;
        } else {
          let hackResult = null;
          if (hackedRole === "Informaticien") {
            const count = workingPlayers.filter((p) => p.alive && p.status === "mutant").length;
            hackResult = `Il y a ${count} mutant${count > 1 ? "s" : ""} à bord du vaisseau.`;
          } else if (hackedRole === "Psychologue") {
            const target = psychoTargetId !== null ? getPlayer(psychoTargetId) : null;
            hackResult = target ? `${target.name} est ${target.status === "mutant" ? "MUTANTE" : "SAINE"}.` : "Le psychologue n'a analysé personne cette nuit.";
          } else if (hackedRole === "Espion") {
            const target = espionTargetId !== null ? getPlayer(espionTargetId) : null;
            hackResult = target
              ? `Mutée : ${mutateId === target.id ? "Oui" : "Non"} / Paralysée : ${paralyzeId === target.id ? "Oui" : "Non"} / Soignée : ${healedIds.has(target.id) ? "Oui" : "Non"}`
              : "L'espion n'a observé personne cette nuit.";
          }
          content = (
            <>
              <PhaseText title="Le hacker se réveille..." sub="Il choisit une information à voler (ou aucune)." />
              {autoInfo && (
                <ResultBox color="#8dff6b">{`Accès automatique (rôle paralysé) :\n${autoInfo}`}</ResultBox>
              )}
              {eligibleRoles.length > 0 && (
                <SelectorBlock icon={Terminal} color="#8dff6b" label="Information volée">
                  <Chip label="Ne rien voler" color="#8dff6b" selected={hackedRole === null} onClick={() => setHackedRole(null)} />
                  {eligibleRoles.map((r) => <Chip key={r} label={r} color="#8dff6b" selected={hackedRole === r} onClick={() => setHackedRole(r)} />)}
                </SelectorBlock>
              )}
              {hackResult && <ResultBox color="#8dff6b">{hackResult}</ResultBox>}
            </>
          );
        }
      }
    }
  }

  const handleSuivant = () => {
    if (currentKey === "Mutants") confirmMutantPhase();
    else if (currentKey === "Médecin") confirmMedecinPhase();
    else goNext();
  };

  return (
    <Backdrop>
      <PlayersToggle players={workingPlayers} captainId={captainId} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, paddingTop: 40 }}>
        <p style={{ color: "#5a6f66", fontSize: 12, letterSpacing: 2, textAlign: "center" }}>
          NUIT {round} — ÉTAPE {stepIndex + 1} / {steps.length}
        </p>
        {content}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
          <PrimaryButton onClick={handleSuivant}>SUIVANT</PrimaryButton>
        </div>
      </div>
      <BackButton onClick={() => setScreen("menu")} />
    </Backdrop>
  );
}

function PhaseText({ title, sub, paralyzed, highlight }) {
  return (
    <div style={{ textAlign: "center", padding: "0 6px" }}>
      <p style={{ fontSize: 19, fontWeight: 700, color: "#e8ecef", whiteSpace: "pre-line", lineHeight: 1.5, margin: 0 }}>{title}</p>
      {sub && (
        <p style={{ fontSize: 15, marginTop: 10, whiteSpace: "pre-line", lineHeight: 1.6, color: paralyzed ? "#ff8f9a" : highlight ? "#8dff6b" : "#c9d3d8", fontWeight: highlight || paralyzed ? 700 : 400 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function SelectorBlock({ icon, label, color, children }) {
  return (
    <div>
      <SectionTitle icon={icon} color={color} title={label} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 2 }}>{children}</div>
    </div>
  );
}

function ResultBox({ color, children }) {
  return (
    <div style={{ marginTop: 4, padding: "12px 16px", borderRadius: 10, border: `1px solid ${color}88`, background: `${color}18`, color, fontSize: 14, fontWeight: 700, whiteSpace: "pre-line", lineHeight: 1.6, textAlign: "center" }}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------
   ECRAN : DISCUSSION (chrono paramétrable)
--------------------------------------------------------- */

function Discussion({ round, minutes, onDone, setScreen }) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (secondsLeft === 0) setRunning(false);
  }, [secondsLeft]);

  const finished = secondsLeft <= 0;

  return (
    <Backdrop>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 22 }}>
        <p style={{ color: "#7f9a8c", letterSpacing: 2, fontSize: 13 }}>DISCUSSION — JOUR {round}</p>
        <Clock size={36} color={finished ? "#ff4d5e" : "#5ea9ff"} />
        <div style={{ fontSize: 64, fontWeight: 900, color: finished ? "#ff4d5e" : "#5ea9ff", textShadow: finished ? "0 0 30px rgba(255,77,94,0.4)" : "0 0 30px rgba(94,169,255,0.4)", fontVariantNumeric: "tabular-nums" }}>
          {formatTime(secondsLeft)}
        </div>
        <p style={{ color: "#c9d3d8", fontSize: 14, textAlign: "center", maxWidth: 280 }}>
          {finished ? "Le temps de discussion est écoulé." : "Débattez : qui pourrait être un mutant ?"}
        </p>
        {!finished && (
          <button onClick={() => setRunning((r) => !r)} style={roundBtnStyle}>
            {running ? <Pause size={22} /> : <Play size={22} />}
          </button>
        )}
        <PrimaryButton onClick={onDone}>PASSER AU VOTE</PrimaryButton>
      </div>
      <BackButton onClick={() => setScreen("menu")} />
    </Backdrop>
  );
}

/* ---------------------------------------------------------
   ECRAN : ÉLECTION DU CAPITAINE (premier vote uniquement)
--------------------------------------------------------- */

function CaptainVote({ players, onDone, setScreen }) {
  const alivePlayers = players.filter((p) => p.alive);
  const [votes, setVotes] = useState({});
  const [activeVoterId, setActiveVoterId] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [drawnCaptainId, setDrawnCaptainId] = useState(null);

  const votedIds = new Set(Object.keys(votes).map((k) => Number(k)));
  const allVoted = alivePlayers.every((p) => votedIds.has(p.id));
  const activeVoter = activeVoterId !== null ? alivePlayers.find((p) => p.id === activeVoterId) : null;

  const confirmVote = () => {
    setVotes((prev) => ({ ...prev, [activeVoterId]: selectedTarget }));
    setActiveVoterId(null);
    setSelectedTarget(null);
  };

  const tally = useMemo(() => {
    const t = {};
    Object.values(votes).forEach((v) => { t[v] = (t[v] || 0) + 1; });
    return t;
  }, [votes]);

  const leaders = useMemo(() => {
    let max = 0;
    let l = [];
    Object.entries(tally).forEach(([id, count]) => {
      if (count > max) { max = count; l = [Number(id)]; }
      else if (count === max) l.push(Number(id));
    });
    return l;
  }, [tally]);

  const winnerId = leaders.length === 1 ? leaders[0] : drawnCaptainId;

  const drawRandom = () => {
    const pick = leaders[Math.floor(Math.random() * leaders.length)];
    setDrawnCaptainId(pick);
  };

  if (activeVoter) {
    const candidates = alivePlayers.filter((p) => p.id !== activeVoter.id);
    return (
      <Backdrop>
        <PlayersToggle players={players} disabled />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, paddingTop: 40 }}>
          <p style={{ textAlign: "center", fontSize: 12, color: "#7f9a8c", letterSpacing: 2 }}>ÉLECTION DU CAPITAINE</p>
          <PhaseText title={`${activeVoter.name}, votez pour le capitaine.`} sub="Le capitaine départagera les votes en cas d'égalité future." />
          <SelectorBlock icon={Crown} color="#ffb454" label="Votre vote">
            {candidates.map((p) => (
              <Chip key={p.id} label={p.name} color="#ffb454" selected={selectedTarget === p.id} onClick={() => setSelectedTarget(p.id)} />
            ))}
          </SelectorBlock>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <PrimaryButton icon={Check} disabled={selectedTarget === null} onClick={confirmVote}>VALIDER MON VOTE</PrimaryButton>
          </div>
          <p style={{ fontSize: 11, color: "#7f9a8c", textAlign: "center" }}>Rendez le téléphone au meneur une fois votre vote validé.</p>
        </div>
        <BackButton onClick={() => setScreen("menu")} />
      </Backdrop>
    );
  }

  if (allVoted && showResults) {
    const captain = winnerId !== null ? players.find((p) => p.id === winnerId) : null;
    return (
      <Backdrop>
        <PlayersToggle players={players} disabled />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, paddingTop: 40 }}>
          <p style={{ textAlign: "center", fontSize: 12, color: "#7f9a8c", letterSpacing: 2 }}>RÉSULTATS — ÉLECTION DU CAPITAINE</p>
          {leaders.length > 1 && !drawnCaptainId ? (
            <>
              <ResultBox color="#ffb454">{"Égalité entre plusieurs joueurs.\nUn tirage au sort va départager."}</ResultBox>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <PrimaryButton icon={Shuffle} onClick={drawRandom}>TIRAGE AU SORT</PrimaryButton>
              </div>
            </>
          ) : (
            <ResultBox color="#ffb454">
              <Crown size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {captain?.name} est élu(e) capitaine.
            </ResultBox>
          )}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <PrimaryButton icon={Check} disabled={winnerId === null} onClick={() => onDone(winnerId)}>CONTINUER</PrimaryButton>
          </div>
        </div>
        <BackButton onClick={() => setScreen("menu")} />
      </Backdrop>
    );
  }

  return (
    <Backdrop>
      <PlayersToggle players={players} disabled />
      <h2 style={{ textAlign: "center", color: "#ffb454", letterSpacing: 1, fontSize: 20, marginBottom: 4, marginTop: 30 }}>ÉLECTION DU CAPITAINE</h2>
      <p style={{ textAlign: "center", fontSize: 12, color: "#7f9a8c", marginTop: 0, marginBottom: 20 }}>
        {allVoted ? "Tout le monde a voté." : "Donnez le téléphone à chaque joueur : il clique sur son prénom pour voter."}
      </p>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <SelectorBlock icon={Users} color="#ffb454" label={`Joueurs (${votedIds.size}/${alivePlayers.length} ont voté)`}>
          {alivePlayers.map((p) => {
            const hasVoted = votedIds.has(p.id);
            return (
              <Chip
                key={p.id}
                label={p.name}
                sub={hasVoted ? "A voté ✓" : "En attente"}
                color="#ffb454"
                selected={false}
                disabled={hasVoted}
                onClick={() => setActiveVoterId(p.id)}
              />
            );
          })}
        </SelectorBlock>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
        <PrimaryButton icon={Check} disabled={!allVoted} onClick={() => setShowResults(true)}>
          VOIR LES RÉSULTATS
        </PrimaryButton>
      </div>
      <BackButton onClick={() => setScreen("menu")} />
    </Backdrop>
  );
}

/* ---------------------------------------------------------
   ECRAN : VOTE DU JOUR (vote interactif joueur par joueur)
--------------------------------------------------------- */

function DayVote({ round, players, captainId, onConfirm, setScreen }) {
  const alivePlayers = players.filter((p) => p.alive);

  // votes[voterId] = targetId (nombre) ou null pour un vote blanc
  const [votes, setVotes] = useState({});
  const [activeVoterId, setActiveVoterId] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [captainPick, setCaptainPick] = useState(null);

  const votedIds = new Set(Object.keys(votes).map((k) => Number(k)));
  const allVoted = alivePlayers.every((p) => votedIds.has(p.id));
  const activeVoter = activeVoterId !== null ? alivePlayers.find((p) => p.id === activeVoterId) : null;
  const captain = captainId !== null ? players.find((p) => p.id === captainId) : null;

  const confirmVote = () => {
    setVotes((prev) => ({ ...prev, [activeVoterId]: selectedTarget }));
    setActiveVoterId(null);
    setSelectedTarget(null);
  };

  // décompte des votes par joueur, + votes blancs à part
  const tally = useMemo(() => {
    const perPlayer = {};
    alivePlayers.forEach((p) => { perPlayer[p.id] = 0; });
    let blanc = 0;
    Object.values(votes).forEach((v) => {
      if (v === null) blanc += 1;
      else perPlayer[v] = (perPlayer[v] || 0) + 1;
    });
    return { perPlayer, blanc };
  }, [votes, alivePlayers]);

  const result = useMemo(() => {
    let max = 0;
    let leaders = [];
    Object.entries(tally.perPlayer).forEach(([id, count]) => {
      if (count > max) { max = count; leaders = [Number(id)]; }
      else if (count === max && count > 0) leaders.push(Number(id));
    });
    if (tally.blanc > max) { max = tally.blanc; leaders = ["BLANC"]; }
    else if (tally.blanc === max && max > 0) leaders.push("BLANC");

    if (leaders.length === 0) return { eliminatedId: null, tie: false, tiedOptions: [] };
    if (leaders.length === 1) {
      return leaders[0] === "BLANC" ? { eliminatedId: null, tie: false, tiedOptions: [] } : { eliminatedId: leaders[0], tie: false, tiedOptions: [] };
    }
    // en cas d'égalité, le capitaine choisit parmi les options à égalité — y compris "vote blanc" si elle en fait partie
    return { eliminatedId: null, tie: true, tiedOptions: leaders };
  }, [tally]);

  const needsCaptainDecision = result.tie && captain && captain.alive;
  const captainMustChoose = needsCaptainDecision && captainPick === null;
  const captainChoseBlanc = needsCaptainDecision && captainPick === "BLANC";
  const tieNoCaptain = result.tie && !needsCaptainDecision;
  const finalEliminatedId = result.tie
    ? (captainPick !== null && captainPick !== "BLANC" ? captainPick : null)
    : result.eliminatedId;

  const handleFinalConfirm = () => {
    const updated = players.map((p) => (p.id === finalEliminatedId ? { ...p, alive: false } : p));
    onConfirm(updated);
  };

  /* --------- écran de vote privé (téléphone donné au joueur) --------- */
  if (activeVoter) {
    const candidates = alivePlayers.filter((p) => p.id !== activeVoter.id);
    return (
      <Backdrop>
        <PlayersToggle players={players} disabled captainId={captainId} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, paddingTop: 40 }}>
          <p style={{ textAlign: "center", fontSize: 12, color: "#7f9a8c", letterSpacing: 2 }}>VOTE DU JOUR {round}</p>
          <PhaseText title={`${activeVoter.name}, à vous de voter.`} sub="Choisissez la personne que vous accusez, ou votez blanc." />
          <SelectorBlock icon={Skull} color="#ffb454" label="Votre vote">
            <Chip label="Vote blanc" color="#ffb454" selected={selectedTarget === null} onClick={() => setSelectedTarget(null)} />
            {candidates.map((p) => (
              <Chip key={p.id} label={p.name} color="#ffb454" selected={selectedTarget === p.id} onClick={() => setSelectedTarget(p.id)} />
            ))}
          </SelectorBlock>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <PrimaryButton icon={Check} onClick={confirmVote}>VALIDER MON VOTE</PrimaryButton>
          </div>
          <p style={{ fontSize: 11, color: "#7f9a8c", textAlign: "center" }}>Rendez le téléphone au meneur une fois votre vote validé.</p>
        </div>
        <BackButton onClick={() => setScreen("menu")} />
      </Backdrop>
    );
  }

  /* --------- écran de résultats --------- */
  if (allVoted && showResults) {
    const eliminatedPlayer = players.find((p) => p.id === finalEliminatedId);
    return (
      <Backdrop>
        <PlayersToggle players={players} disabled captainId={captainId} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, paddingTop: 30, overflowY: "auto" }}>
          <p style={{ textAlign: "center", fontSize: 12, color: "#7f9a8c", letterSpacing: 2 }}>RÉSULTATS DU VOTE — JOUR {round}</p>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14 }}>
            {alivePlayers.map((p) => {
              const count = tally.perPlayer[p.id] || 0;
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 2px", fontSize: 13 }}>
                  <span>{p.name}</span>
                  <span style={{ color: "#ffb454", fontWeight: 700 }}>{count} vote{count > 1 ? "s" : ""}</span>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 2px", fontSize: 13, opacity: 0.7 }}>
              <span>Vote blanc</span>
              <span style={{ fontWeight: 700 }}>{tally.blanc} vote{tally.blanc > 1 ? "s" : ""}</span>
            </div>
          </div>

          {captainMustChoose && (
            <>
              <ResultBox color="#ffb454">{"Égalité !\nLe capitaine départage (il peut aussi choisir le vote blanc pour n'éliminer personne)."}</ResultBox>
              <SelectorBlock icon={Crown} color="#ffb454" label={`${captain.name} (capitaine) tranche`}>
                {result.tiedOptions.includes("BLANC") && (
                  <Chip label="Vote blanc" color="#ffb454" selected={captainPick === "BLANC"} onClick={() => setCaptainPick("BLANC")} />
                )}
                {result.tiedOptions.filter((o) => o !== "BLANC").map((id) => {
                  const p = players.find((pl) => pl.id === id);
                  return <Chip key={id} label={p.name} color="#ffb454" selected={captainPick === id} onClick={() => setCaptainPick(id)} />;
                })}
              </SelectorBlock>
            </>
          )}

          {captainChoseBlanc && (
            <ResultBox color="#ffb454">{"Le capitaine a tranché : personne n'est éliminé."}</ResultBox>
          )}

          {tieNoCaptain && (
            <ResultBox color="#ffb454">{"Égalité, et aucun capitaine n'est en mesure de départager.\nPersonne n'est éliminé."}</ResultBox>
          )}

          {!result.tie && result.eliminatedId === null && (
            <ResultBox color="#ffb454">{"Majorité de votes blancs.\nPersonne n'est éliminé."}</ResultBox>
          )}

          {finalEliminatedId !== null && (
            <ResultBox color="#ff4d5e">
              {eliminatedPlayer?.name} est désigné(e) par l'équipage.{"\n"}
              Rôle : {eliminatedPlayer?.role}{"\n"}
              Statut : {eliminatedPlayer?.status === "mutant" ? "MUTANT" : "SAIN"}
            </ResultBox>
          )}

          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <PrimaryButton icon={Check} disabled={captainMustChoose} onClick={handleFinalConfirm}>
              VALIDER ET PASSER À LA NUIT SUIVANTE
            </PrimaryButton>
          </div>
        </div>
        <BackButton onClick={() => setScreen("menu")} />
      </Backdrop>
    );
  }

  /* --------- grille de sélection : qui vote maintenant --------- */
  return (
    <Backdrop>
      <PlayersToggle players={players} disabled captainId={captainId} />
      <h2 style={{ textAlign: "center", color: "#ffb454", letterSpacing: 1, fontSize: 20, marginBottom: 4, marginTop: 30 }}>VOTE DU JOUR {round}</h2>
      <p style={{ textAlign: "center", fontSize: 12, color: "#7f9a8c", marginTop: 0, marginBottom: 20 }}>
        {allVoted ? "Tout le monde a voté." : "Donnez le téléphone à chaque joueur : il clique sur son prénom pour voter."}
      </p>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <SelectorBlock icon={Users} color="#ffb454" label={`Joueurs (${votedIds.size}/${alivePlayers.length} ont voté)`}>
          {alivePlayers.map((p) => {
            const hasVoted = votedIds.has(p.id);
            return (
              <Chip
                key={p.id}
                label={p.name}
                sub={hasVoted ? "A voté ✓" : "En attente"}
                color="#ffb454"
                selected={false}
                disabled={hasVoted}
                onClick={() => setActiveVoterId(p.id)}
              />
            );
          })}
        </SelectorBlock>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
        <PrimaryButton icon={Check} disabled={!allVoted} onClick={() => setShowResults(true)}>
          VOIR LES RÉSULTATS
        </PrimaryButton>
      </div>
      <BackButton onClick={() => setScreen("menu")} />
    </Backdrop>
  );
}

/* ---------------------------------------------------------
   ECRAN : FIN DE PARTIE
--------------------------------------------------------- */

function EndScreen({ winner, reason, players, captainId, onRestart, setScreen }) {
  const label = winner === "mutants" ? "LES MUTANTS ONT PRIS LE VAISSEAU" : winner === "sains" ? "LES ASTRONAUTES SAINS ONT SURVÉCU" : "PLUS AUCUN SURVIVANT";
  const color = winner === "mutants" ? "#ff4d5e" : winner === "sains" ? "#8dff6b" : "#7f9a8c";
  return (
    <Backdrop>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 40, marginBottom: 20 }}>
        <Trophy size={40} color={color} style={{ filter: `drop-shadow(0 0 14px ${color}88)` }} />
        <h2 style={{ textAlign: "center", color, fontSize: 20, letterSpacing: 1 }}>{label}</h2>
        {reason === "medecins-incapacites" && (
          <p style={{ textAlign: "center", color: "#c9d3d8", fontSize: 13, maxWidth: 300 }}>
            Plus aucun médecin sain et disponible ne peut soigner : fin de partie automatique.
          </p>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 14 }}>
        {players.map((p) => {
          const info = ROLE_INFO[p.role];
          const Icon = info.icon;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 4px", borderBottom: "1px solid rgba(255,255,255,0.06)", opacity: p.alive ? 1 : 0.5 }}>
              <Icon size={18} color={info.color} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, textDecoration: p.alive ? "none" : "line-through" }}>
                  {p.name}{captainId === p.id && <CaptainBadge />}
                </div>
                <div style={{ fontSize: 11, color: info.color }}>{p.role}</div>
              </div>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, color: p.status === "mutant" ? "#ff8f9a" : "#9fe8c8", border: `1px solid ${p.status === "mutant" ? "#ff4d5e" : "#4fd67a"}` }}>
                {p.status === "mutant" ? "MUTANT" : "SAIN"}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 20, marginBottom: 60 }}>
        <PrimaryButton onClick={onRestart}>NOUVELLE PARTIE</PrimaryButton>
      </div>
      <BackButton onClick={() => setScreen("menu")} />
    </Backdrop>
  );
}

/* ---------------------------------------------------------
   ECRAN : REGLES
--------------------------------------------------------- */

function Rules({ setScreen }) {
  return (
    <Backdrop>
      <h2 style={{ textAlign: "center", color: "#8dff6b", letterSpacing: 2, fontSize: 22, marginBottom: 18 }}>RÈGLES DU JEU</h2>
      <div style={{ flex: 1, overflowY: "auto", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 18 }}>
        {RULES_SECTIONS.map((section, i) => (
          <div key={i} style={{ marginBottom: 22 }}>
            <h3 style={{ color: "#8dff6b", fontSize: 15, letterSpacing: 1, marginBottom: 8 }}>{section.title.toUpperCase()}</h3>
            {section.body && <p style={{ fontSize: 14, lineHeight: 1.7, color: "#d5dadd", whiteSpace: "pre-line", textAlign: "justify", margin: 0 }}>{section.body}</p>}
            {section.roles && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(ROLE_INFO).map(([name, info]) => {
                  const Icon = info.icon;
                  return (
                    <div key={name} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <Icon size={18} color={info.color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#d5dadd" }}>
                        <span style={{ color: info.color, fontWeight: 700 }}>{name}</span> : {info.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ height: 60 }} />
      <BackButton onClick={() => setScreen("menu")} />
    </Backdrop>
  );
}

/* ---------------------------------------------------------
   APP
--------------------------------------------------------- */

export default function App() {
  const [screen, setScreen] = useState("menu");
  const [numPlayers, setNumPlayers] = useState(6);
  const [includeTraitre, setIncludeTraitre] = useState(false);
  const [includeEspion, setIncludeEspion] = useState(false);
  const [astronautCount, setAstronautCount] = useState(0);
  const [discussionMinutes, setDiscussionMinutes] = useState(5);
  const [roles, setRoles] = useState([]);
  const [players, setPlayers] = useState([]);
  const [round, setRound] = useState(1);
  const [winner, setWinner] = useState(null);
  const [endReason, setEndReason] = useState(null);
  const [captainId, setCaptainId] = useState(null);

  const goToMenu = () => {
    setPlayers([]);
    setRoles([]);
    setRound(1);
    setWinner(null);
    setEndReason(null);
    setCaptainId(null);
    setScreen("menu");
  };

  const handleValidatePlayers = (n) => {
    setRoles(generateRoles(n, { traitre: includeTraitre, espion: includeEspion, astronautes: astronautCount }));
    setScreen("role");
  };

  const handleRoleFinish = (finishedPlayers) => {
    setPlayers(finishedPlayers);
    setRound(1);
    setScreen("medecinReco");
  };

  const handleMedecinRecoContinue = () => {
    setScreen("game");
  };

  const handleNightComplete = (updatedPlayers) => {
    setPlayers(updatedPlayers);
    const w = checkWinner(updatedPlayers);
    if (w) { setWinner(w); setScreen("end"); }
    else setScreen(captainId === null ? "captainVote" : "discussion");
  };

  const handleAutoEnd = (updatedPlayers) => {
    setPlayers(updatedPlayers);
    setWinner("mutants");
    setEndReason("medecins-incapacites");
    setScreen("end");
  };

  const handleDiscussionDone = () => {
    setScreen("dayVote");
  };

  const handleCaptainChosen = (id) => {
    setCaptainId(id);
    setScreen("discussion");
  };

  const handleDayVoteConfirm = (updatedPlayers) => {
    setPlayers(updatedPlayers);
    const w = checkWinner(updatedPlayers);
    if (w) { setWinner(w); setScreen("end"); }
    else { setRound((r) => r + 1); setScreen("game"); }
  };

  if (screen === "menu") return <Menu setScreen={setScreen} />;
  if (screen === "rules") return <Rules setScreen={goToMenu} />;
  if (screen === "playerSelect")
    return (
      <PlayerSelect
        numPlayers={numPlayers} setNumPlayers={setNumPlayers}
        includeTraitre={includeTraitre} setIncludeTraitre={setIncludeTraitre}
        includeEspion={includeEspion} setIncludeEspion={setIncludeEspion}
        astronautCount={astronautCount} setAstronautCount={setAstronautCount}
        discussionMinutes={discussionMinutes} setDiscussionMinutes={setDiscussionMinutes}
        onValidate={handleValidatePlayers} setScreen={goToMenu}
      />
    );
  if (screen === "role")
    return <RolePhase roles={roles} onFinish={handleRoleFinish} setScreen={goToMenu} />;
  if (screen === "medecinReco")
    return <MedecinReco players={players} onContinue={handleMedecinRecoContinue} setScreen={goToMenu} />;
  if (screen === "game")
    return <NightGame key={round} round={round} players={players} captainId={captainId} onComplete={handleNightComplete} onAutoEnd={handleAutoEnd} setScreen={goToMenu} />;
  if (screen === "discussion")
    return <Discussion key={round} round={round} minutes={discussionMinutes} onDone={handleDiscussionDone} setScreen={goToMenu} />;
  if (screen === "captainVote")
    return <CaptainVote players={players} onDone={handleCaptainChosen} setScreen={goToMenu} />;
  if (screen === "dayVote")
    return <DayVote key={round} round={round} players={players} captainId={captainId} onConfirm={handleDayVoteConfirm} setScreen={goToMenu} />;
  if (screen === "end")
    return <EndScreen winner={winner} reason={endReason} players={players} captainId={captainId} onRestart={goToMenu} setScreen={goToMenu} />;

  return null;
}
