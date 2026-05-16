export const IVA_RATE = 0.19;

// ─── HTML export helpers ──────────────────────────────────────────────

export function fmtMoney(v: number): string {
  return '$ ' + Number(v || 0).toLocaleString('es-CL', { minimumFractionDigits: 2 });
}

export function fmtDate(input?: string): string {
  if (!input) return '-';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-CL');
}

export function scape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const ROKA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1079 1079" width="52" height="52" style="flex-shrink:0;border-radius:8px">
  <rect width="1079" height="1079" fill="#ea9a00"/>
  <path d="M 656,606 L 646,591 L 635,591 L 356,678 L 318,777 L 343,776 L 374,702 L 656,615 Z M 989,597 L 968,585 L 815,818 L 282,818 L 293,843 L 834,843 Z M 885,539 L 868,522 L 858,522 L 691,574 L 691,583 L 701,598 L 711,598 L 873,547 L 885,547 Z" fill="#c58200" opacity="0.9"/>
  <path d="M 972,572 L 664,252 L 327,348 L 116,565 L 273,816 L 815,816 Z M 764,770 L 763,779 L 315,778 L 355,676 L 637,588 L 649,591 Z M 370,522 L 370,535 L 283,748 L 275,748 L 173,589 L 173,579 Z M 868,519 L 922,575 L 922,583 L 811,753 L 800,756 L 690,586 L 688,573 Z M 831,480 L 828,490 L 377,626 L 426,503 L 760,407 Z M 722,367 L 720,377 L 219,522 L 219,514 L 350,380 L 653,296 Z" fill="white" fill-rule="evenodd"/>
</svg>`;
