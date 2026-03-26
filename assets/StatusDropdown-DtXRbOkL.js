import{F as o,j as e,aK as p,aL as u,g as h,aM as x,aN as j}from"./index-CtUiToS-.js";import{B as y}from"./badge-CracOL0D.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=o("Clock4",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=o("History",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);function f({statusConfig:t,currentStatus:r,onStatusChange:c,align:l="start",disabled:i=!1}){const a=t[r];if(!a)return null;const m=a.icon;return e.jsxs(p,{modal:!1,children:[e.jsx(u,{asChild:!0,disabled:i,children:e.jsxs("button",{type:"button",onClick:s=>s.stopPropagation(),className:"flex items-center gap-1.5 hover:opacity-80 transition-opacity outline-none",children:[e.jsx(m,{className:`h-4 w-4 ${a.iconClassName}`}),e.jsx(y,{variant:a.badgeVariant,className:a.badgeClassName,children:a.label}),e.jsx(h,{className:"h-3 w-3 text-muted-foreground"})]})}),e.jsx(x,{align:l,className:"w-[140px]",children:Object.entries(t).map(([s,n])=>{const d=n.icon;return e.jsxs(j,{onSelect:()=>c(s),className:`gap-2 ${n.menuItemClassName||""}`,children:[e.jsx(d,{className:`h-4 w-4 ${n.iconClassName}`}),n.label]},s)})})]})}export{C,w as H,f as S};
