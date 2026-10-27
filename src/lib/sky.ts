/**
 * Mapa de estrelas estilizado (cálculo próprio simplificado):
 * catálogo das estrelas mais brilhantes (J2000) + posição alt/az para data, hora e local,
 * projeção azimutal equidistante centrada no zênite. Precisão suficiente para fins decorativos
 * (ignora precessão, nutação e refração).
 */

type Star = [name: string, raHours: number, decDeg: number, mag: number];

export const STARS: Star[] = [
  ["Sirius", 6.7525, -16.716, -1.46], ["Canopus", 6.399, -52.696, -0.74], ["Arcturus", 14.261, 19.182, -0.05],
  ["Rigil Kentaurus", 14.66, -60.834, -0.27], ["Vega", 18.616, 38.784, 0.03], ["Capella", 5.278, 45.998, 0.08],
  ["Rigel", 5.242, -8.202, 0.13], ["Procyon", 7.655, 5.225, 0.34], ["Achernar", 1.629, -57.237, 0.46],
  ["Betelgeuse", 5.919, 7.407, 0.5], ["Hadar", 14.064, -60.373, 0.61], ["Altair", 19.846, 8.868, 0.76],
  ["Acrux", 12.443, -63.099, 0.77], ["Aldebaran", 4.599, 16.509, 0.85], ["Antares", 16.49, -26.432, 0.96],
  ["Spica", 13.42, -11.161, 0.97], ["Pollux", 7.755, 28.026, 1.14], ["Fomalhaut", 22.961, -29.622, 1.16],
  ["Deneb", 20.69, 45.28, 1.25], ["Mimosa", 12.795, -59.689, 1.25], ["Regulus", 10.139, 11.967, 1.35],
  ["Adhara", 6.977, -28.972, 1.5], ["Castor", 7.577, 31.888, 1.58], ["Gacrux", 12.519, -57.113, 1.63],
  ["Shaula", 17.56, -37.104, 1.62], ["Bellatrix", 5.419, 6.35, 1.64], ["Elnath", 5.438, 28.608, 1.65],
  ["Miaplacidus", 9.22, -69.717, 1.67], ["Alnilam", 5.604, -1.202, 1.69], ["Alnitak", 5.679, -1.943, 1.74],
  ["Alnair", 22.137, -46.961, 1.74], ["Alioth", 12.9, 55.96, 1.76], ["Dubhe", 11.062, 61.751, 1.79],
  ["Mirfak", 3.405, 49.861, 1.79], ["Wezen", 7.14, -26.393, 1.83], ["Sargas", 17.622, -42.998, 1.86],
  ["Kaus Australis", 18.403, -34.385, 1.85], ["Avior", 8.375, -59.509, 1.86], ["Alkaid", 13.792, 49.313, 1.86],
  ["Menkalinan", 5.992, 44.947, 1.9], ["Atria", 16.811, -69.028, 1.91], ["Alhena", 6.629, 16.399, 1.93],
  ["Peacock", 20.427, -56.735, 1.94], ["Polaris", 2.53, 89.264, 1.98], ["Mirzam", 6.378, -17.956, 1.98],
  ["Alphard", 9.46, -8.659, 1.98], ["Hamal", 2.12, 23.462, 2.0], ["Diphda", 0.727, -17.987, 2.04],
  ["Nunki", 18.921, -26.297, 2.05], ["Menkent", 14.111, -36.37, 2.06], ["Mintaka", 5.533, -0.299, 2.23],
  ["Saiph", 5.796, -9.67, 2.06], ["Alpheratz", 0.14, 29.091, 2.06], ["Mizar", 13.399, 54.925, 2.23],
  ["Merak", 11.031, 56.382, 2.37], ["Phecda", 11.897, 53.695, 2.44], ["Megrez", 12.257, 57.033, 3.31],
  ["Schedar", 0.675, 56.537, 2.24], ["Caph", 0.153, 59.15, 2.28], ["Gamma Cas", 0.945, 60.717, 2.47],
  ["Ruchbah", 1.43, 60.235, 2.68], ["Segin", 1.907, 63.67, 3.37], ["Delta Cru", 12.252, -58.749, 2.79],
  ["Epsilon Cru", 12.356, -60.401, 3.59], ["Dschubba", 16.006, -22.622, 2.29], ["Graffias", 16.091, -19.806, 2.62],
  ["Epsilon Sco", 16.836, -34.293, 2.29], ["Mu Sco", 16.864, -38.047, 3.0], ["Zeta Sco", 16.91, -42.36, 3.6],
  ["Eta Sco", 17.202, -43.239, 3.33], ["Iota Sco", 17.793, -40.127, 3.0], ["Kappa Sco", 17.708, -39.03, 2.39],
  ["Tau Sco", 16.598, -28.216, 2.82], ["Sigma Sco", 16.353, -25.593, 2.89], ["Denebola", 11.818, 14.572, 2.14],
  ["Algieba", 10.333, 19.842, 2.0], ["Zosma", 11.235, 20.524, 2.56], ["Chertan", 11.237, 15.43, 3.3],
  ["Eta Leo", 10.122, 16.763, 3.5], ["Adhafera", 10.278, 23.417, 3.4], ["Ras Elased", 9.764, 23.774, 2.98],
  ["Albireo", 19.512, 27.96, 3.05], ["Sadr", 20.37, 40.257, 2.23], ["Gienah Cyg", 20.77, 33.97, 2.48],
  ["Delta Cyg", 19.75, 45.131, 2.87], ["Sulafat", 18.982, 32.69, 3.24], ["Sheliak", 18.835, 33.363, 3.5],
  ["Aludra", 7.402, -29.303, 2.45], ["Alcyone", 3.791, 24.105, 2.87],
];

export const CONSTELLATIONS: { name: string; lines: [string, string][] }[] = [
  { name: "Órion", lines: [["Betelgeuse", "Bellatrix"], ["Bellatrix", "Mintaka"], ["Mintaka", "Alnilam"], ["Alnilam", "Alnitak"], ["Alnitak", "Saiph"], ["Saiph", "Rigel"], ["Rigel", "Mintaka"], ["Betelgeuse", "Alnitak"]] },
  { name: "Cruzeiro do Sul", lines: [["Acrux", "Gacrux"], ["Mimosa", "Delta Cru"]] },
  { name: "Centauro", lines: [["Rigil Kentaurus", "Hadar"]] },
  { name: "Escorpião", lines: [["Graffias", "Dschubba"], ["Dschubba", "Sigma Sco"], ["Sigma Sco", "Antares"], ["Antares", "Tau Sco"], ["Tau Sco", "Epsilon Sco"], ["Epsilon Sco", "Mu Sco"], ["Mu Sco", "Zeta Sco"], ["Zeta Sco", "Eta Sco"], ["Eta Sco", "Sargas"], ["Sargas", "Iota Sco"], ["Iota Sco", "Kappa Sco"], ["Kappa Sco", "Shaula"]] },
  { name: "Ursa Maior", lines: [["Dubhe", "Merak"], ["Merak", "Phecda"], ["Phecda", "Megrez"], ["Megrez", "Dubhe"], ["Megrez", "Alioth"], ["Alioth", "Mizar"], ["Mizar", "Alkaid"]] },
  { name: "Cassiopeia", lines: [["Caph", "Schedar"], ["Schedar", "Gamma Cas"], ["Gamma Cas", "Ruchbah"], ["Ruchbah", "Segin"]] },
  { name: "Leão", lines: [["Regulus", "Eta Leo"], ["Eta Leo", "Algieba"], ["Algieba", "Adhafera"], ["Adhafera", "Ras Elased"], ["Algieba", "Zosma"], ["Zosma", "Denebola"], ["Denebola", "Chertan"], ["Chertan", "Regulus"], ["Zosma", "Chertan"]] },
  { name: "Cisne", lines: [["Deneb", "Sadr"], ["Sadr", "Albireo"], ["Delta Cyg", "Sadr"], ["Sadr", "Gienah Cyg"]] },
  { name: "Lira", lines: [["Vega", "Sheliak"], ["Sheliak", "Sulafat"], ["Sulafat", "Vega"]] },
  { name: "Cão Maior", lines: [["Sirius", "Mirzam"], ["Sirius", "Adhara"], ["Adhara", "Wezen"], ["Wezen", "Aludra"], ["Sirius", "Wezen"]] },
  { name: "Gêmeos", lines: [["Castor", "Pollux"], ["Pollux", "Alhena"]] },
];

const RAD = Math.PI / 180;

export function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

/** Tempo sideral local em graus. */
export function localSiderealDeg(date: Date, lngDeg: number): number {
  const d = julianDate(date) - 2451545.0;
  const gmst = 280.46061837 + 360.98564736629 * d;
  return (((gmst + lngDeg) % 360) + 360) % 360;
}

export function altAz(raHours: number, decDeg: number, latDeg: number, lstDeg: number): { alt: number; az: number } {
  const ha = (lstDeg - raHours * 15) * RAD;
  const dec = decDeg * RAD;
  const lat = latDeg * RAD;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(sinAlt);
  const az = Math.atan2(-Math.sin(ha) * Math.cos(dec), Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(ha));
  return { alt: alt / RAD, az: ((az / RAD) + 360) % 360 };
}

export interface ProjectedStar {
  name: string;
  x: number;
  y: number;
  r: number;
  mag: number;
}

/** Converte data local (AAAA-MM-DD + HH:mm) usando fuso aproximado pela longitude. */
export function skyInstant(date: string, time: string, lng: number): Date {
  const offset = Math.round(lng / 15); // ex.: -46° → UTC-3
  const sign = offset <= 0 ? "-" : "+";
  const hh = String(Math.abs(offset)).padStart(2, "0");
  return new Date(`${date}T${time || "21:00"}:00${sign}${hh}:00`);
}

export function projectSky(instant: Date, lat: number, lng: number, size = 500) {
  const lst = localSiderealDeg(instant, lng);
  const c = size / 2;
  const R = size / 2 - 4;
  const map = new Map<string, ProjectedStar>();
  for (const [name, ra, dec, mag] of STARS) {
    const { alt, az } = altAz(ra, dec, lat, lst);
    if (alt <= 0) continue;
    const r = ((90 - alt) / 90) * R;
    // Olhando para cima com o norte no topo, o leste fica à esquerda.
    const x = c - r * Math.sin(az * RAD);
    const y = c - r * Math.cos(az * RAD);
    map.set(name, { name, x, y, r: Math.max(0.8, 3.6 - mag * 0.85), mag });
  }
  const lines: { x1: number; y1: number; x2: number; y2: number; constellation: string }[] = [];
  for (const cons of CONSTELLATIONS) {
    for (const [a, b] of cons.lines) {
      const sa = map.get(a);
      const sb = map.get(b);
      if (sa && sb) lines.push({ x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y, constellation: cons.name });
    }
  }
  return { stars: [...map.values()], lines };
}

/** Estrelas de fundo determinísticas (decorativas), semeadas pela data. */
export function backgroundStars(seed: string, count: number, size = 500): { x: number; y: number; r: number; o: number }[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [];
  const c = size / 2;
  while (out.length < count) {
    const x = rand() * size;
    const y = rand() * size;
    if ((x - c) ** 2 + (y - c) ** 2 > (c - 6) ** 2) continue;
    out.push({ x, y, r: rand() * 0.9 + 0.2, o: rand() * 0.6 + 0.2 });
  }
  return out;
}
