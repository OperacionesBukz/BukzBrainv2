import{D as r,j as e,ai as u,aj as h,g as p,ak as x,al as j}from"./index-BMadzbpN.js";import{B as y}from"./badge-YJXXPihT.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=r("Clock4",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=r("History",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);function f({statusConfig:n,currentStatus:o,onStatusChange:c,align:l="start",disabled:i=!1}){const a=n[o];if(!a)return null;const m=a.icon;return e.jsxs(u,{modal:!1,children:[e.jsx(h,{asChild:!0,disabled:i,children:e.jsxs("button",{type:"button",className:"flex items-center gap-1.5 hover:opacity-80 transition-opacity outline-none",children:[e.jsx(m,{className:`h-4 w-4 ${a.iconClassName}`}),e.jsx(y,{variant:a.badgeVariant,className:a.badgeClassName,children:a.label}),e.jsx(p,{className:"h-3 w-3 text-muted-foreground"})]})}),e.jsx(x,{align:l,className:"w-[140px]",children:Object.entries(n).map(([t,s])=>{const d=s.icon;return e.jsxs(j,{onClick:()=>c(t),className:`gap-2 ${s.menuItemClassName||""}`,children:[e.jsx(d,{className:`h-4 w-4 ${s.iconClassName}`}),s.label]},t)})})]})}export{g as C,w as H,f as S};
