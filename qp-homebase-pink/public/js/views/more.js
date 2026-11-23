import { go } from "../app.js";
export const title = "More";
const TILES = [
  ["todo", "✓", "To-do list"], ["house", "🧹", "Housework"], ["cycle", "🌸", "Period tracker"],
  ["bible", "✝", "Bible"], ["journal", "✎", "Journal"], ["jay", "💬", "Ask Jay"],
  ["planner", "◷", "Planner"], ["meals", "❦", "Meals"], ["money", "£", "Budget"],
  ["settings", "⚙︎", "Settings"],
];
export function render(el) {
  el.innerHTML = `<div class="more-grid" style="margin-top:8px">${TILES.map(([k, i, n]) => `<button class="tile" data-to="${k}"><i>${i}</i>${n}</button>`).join("")}</div>`;
  el.onclick = (e) => { const b = e.target.closest("[data-to]"); if (b) go(b.dataset.to); };
}
