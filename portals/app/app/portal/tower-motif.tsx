// Decorative service topology, not a live network status display.
export default function TowerMotif() {
 return <svg className="home-motif" width="500" height="270" viewBox="0 0 500 270" fill="none" aria-hidden="true">
  {/* Both line families share one isometric basis and the same boundary. */}
  <path d="M250 65 450 165 250 265 50 165Z" fill="var(--primary-muted)" fillOpacity=".18" stroke="currentColor" strokeOpacity=".16"/>
  <g stroke="currentColor" strokeWidth=".75" opacity=".12">
   {Array.from({length:7},(_,i)=>{const step=(i+1)*25;return <path key={i} d={`M${250+step} ${65+step/2}L${50+step} ${165+step/2}M${250-step} ${65+step/2}L${450-step} ${165+step/2}`}/>;})}
  </g>
  <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
   <path d="M222 204 250 76 278 204M234 150h32M228 177h44M222 204h56M239 126h22M240 126l26 24-38 27 50 27M260 126l-26 24 38 27-50 27" opacity=".65"/>
   <path d="M250 76V52M237 63v24M263 63v24M230 204h-14M284 204h-14"/>
   <g className="home-signal"><path d="M224 53a36 36 0 0 0 0 43M276 53a36 36 0 0 1 0 43" opacity=".5"/><path d="M213 43a51 51 0 0 0 0 63M287 43a51 51 0 0 1 0 63" opacity=".25"/></g>
   <g strokeOpacity=".35" strokeDasharray="4 5"><path d="M244 186 140 151 91 180"/><path d="M260 184 357 143 413 180"/><path d="M252 205 254 242"/></g>
   <g fill="var(--background)"><path d="m124 140 16-8 16 8v22l-16 8-16-8Z"/><path d="m340 131 17-8 17 8v24l-17 8-17-8Z"/><path d="m238 231 16-8 16 8v20l-16 8-16-8Z"/></g>
   <path d="m124 140 16 8 16-8m-16 8v22m200-39 17 8 17-8m-17 8v24m-119 68 16 8 16-8m-16 8v20" opacity=".45"/>
   <g fill="var(--background)">{[[91,180],[413,180],[250,76]].map(([x,y])=><circle key={x} cx={x} cy={y} r="4"/>)}</g>
   <path className="home-flow" d="M91 180 140 151 244 186M260 184 357 143 413 180M252 205 254 223" stroke="var(--primary)" strokeWidth="2.5" strokeDasharray="2 180"/>
  </g>
 </svg>;
}
