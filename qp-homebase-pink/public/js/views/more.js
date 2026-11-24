import { go, icon } from "../app.js";
export const title = "More";
const TILES = [
  ["todo", "todo", "To-do list"], ["house", "house", "Housework"], ["cycle", "cycle", "Period tracker"],
  ["bible", "bible", "Bible"], ["journal", "journal", "Journal"], ["jay", "jay", "Ask Jay"],
  ["planner", "planner", "Planner"], ["meals", "meals", "Meals"], ["money", "money", "Budget"],
  ["settings", "settings", "Settings"],
];
export function render(el) {
  el.innerHTML = `<div class="more-grid" style="margin-top:8px">${TILES.map(([k, i, n]) => `<button class="tile" data-to="${k}"><i>${icon(i)}</i>${n}</button>`).join("")}</div>`;
  el.onclick = (e) => { const b = e.target.closest("[data-to]"); if (b) go(b.dataset.to); };
}
