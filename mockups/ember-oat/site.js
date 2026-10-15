(() => {
  const order = [];
  const count = document.getElementById('orderCount');
  function addItem(name, price) {
    order.push({ name, price });
    count.textContent = order.length;
    count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump');
    setTimeout(() => count.classList.remove('bump'), 400);
    toast(`Added ${name}, £${price.toFixed(2)}`);
  }
  document.getElementById('orderPill').onclick = document.getElementById('checkout').onclick = () => {
    if (!order.length) return toast('Your order is empty. Build a drink or add something from the menu.');
    const total = order.reduce((s, i) => s + i.price, 0);
    toast(`${order.length} item${order.length > 1 ? 's' : ''}, £${total.toFixed(2)}. Ready in about 6 minutes.`);
  };

  // Drink builder
  const state = { drink: 'flat', milk: 'whole', shots: '0' };
  const prices = { drink: 3.4, milk: 0, shots: 0 };
  const names = { flat: 'Flat white', latte: 'Latte', cortado: 'Cortado', filter: 'Filter' };
  const drinkImg = document.getElementById('drinkImg');
  function drawCup() {
    const noMilk = state.milk === 'none' || state.drink === 'filter';
    const src = 'assets/drink-' + state.drink + '.jpg';
    if (!drinkImg.src.endsWith(src)) {
      drinkImg.classList.add('out');
      setTimeout(() => { drinkImg.src = src; drinkImg.alt = names[state.drink]; drinkImg.onload = () => drinkImg.classList.remove('out'); }, 250);
    }
    document.getElementById('drinkBadge').textContent = (noMilk ? 'Black' : state.milk[0].toUpperCase() + state.milk.slice(1) + ' milk') + (+state.shots ? ` · +${state.shots} shot${+state.shots > 1 ? 's' : ''}` : '');
    const total = prices.drink + (noMilk ? 0 : prices.milk) + prices.shots;
    document.getElementById('price').textContent = total.toFixed(2);
    return total;
  }
  document.querySelectorAll('.chips').forEach((g) => {
    g.addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      g.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === b));
      state[g.dataset.group] = b.dataset.v;
      prices[g.dataset.group] = parseFloat(b.dataset.p);
      drawCup();
    });
  });
  drawCup();
  document.getElementById('addDrink').onclick = () => {
    const milk = state.milk !== 'whole' && state.milk !== 'none' ? ` with ${state.milk}` : '';
    const extra = +state.shots ? ` +${state.shots} shot` : '';
    addItem(names[state.drink] + milk + extra, drawCup());
  };

  // Menu tabs
  const menu = {
    coffee: [['Espresso', 'Double shot, house blend', 2.6], ['Flat white', 'Silky, strong, small', 3.4], ['Latte', 'Bigger and gentler', 3.6], ['Guest filter', 'Changes monthly', 3.0], ['Iced oat latte', 'Summer favourite', 3.9], ['Hot chocolate', '70% dark, whole milk', 3.5]],
    bakes: [['Almond croissant', 'Twice baked', 3.8], ['Cardamom bun', 'Swedish style knot', 3.4], ['Banana bread', 'Toasted with butter', 3.2], ['Pain au chocolat', 'Two batons inside', 3.1], ['Sourdough toast', 'Jam or marmite', 3.0], ['Brown butter cookie', 'Sea salt on top', 2.4]],
    brunch: [['Eggs on toast', 'Soft scrambled, chives', 7.5], ['Avocado toast', 'Chilli, lime, feta', 8.5], ['Granola bowl', 'Yoghurt, poached fruit', 6.8], ['Mushroom melt', 'Gruyère, thyme', 8.9], ['Kids toast', 'Butter and honey', 3.5], ['Porridge', 'Oat milk, maple, apple', 6.0]],
  };
  const list = document.getElementById('menuList');
  const tabs = document.querySelectorAll('.tabs button');
  const slider = document.querySelector('.tabs .slider');
  function show(tab) {
    tabs.forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === tab));
    const cur = [...tabs].find((t) => t.dataset.tab === tab);
    slider.style.left = cur.offsetLeft + 'px'; slider.style.width = cur.offsetWidth + 'px';
    list.innerHTML = menu[tab].map(([n, d, p], i) => `<li style="--n:${i}"><div><b>${n}</b><small>${d}</small></div><span class="dots"></span><span>£${p.toFixed(2)}</span><button class="add" type="button" aria-label="Add ${n}" data-n="${n}" data-p="${p}">+</button></li>`).join('');
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  list.addEventListener('click', (e) => { const b = e.target.closest('.add'); if (b) addItem(b.dataset.n, +b.dataset.p); });
  show('coffee');
  addEventListener('resize', () => show(document.querySelector('.tabs [aria-selected="true"]').dataset.tab));
  document.fonts && document.fonts.ready.then(() => show(document.querySelector('.tabs [aria-selected="true"]').dataset.tab));

  // Live order card in the hero
  const lcImg = document.getElementById('lcImg');
  let lcDrink = 'flat';
  document.getElementById('lcPills').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#lcPills button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    lcDrink = b.dataset.d; lcImg.style.opacity = 0;
    setTimeout(() => { lcImg.src = 'assets/drink-' + lcDrink + '.jpg'; lcImg.alt = names[lcDrink]; lcImg.onload = () => (lcImg.style.opacity = 1); }, 200);
  });
  const basePrice = { flat: 3.4, latte: 3.6, cortado: 3.1, filter: 3.0 };
  document.getElementById('lcAdd').onclick = () => addItem(names[lcDrink], basePrice[lcDrink]);
  let queue = 4;
  setInterval(() => {
    queue = Math.max(1, Math.min(9, queue + (Math.random() < .5 ? -1 : 1)));
    document.getElementById('lcQueue').textContent = queue + ' in the queue';
    document.getElementById('lcMins').textContent = 2 + queue;
  }, 3500);

  // Open now
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60, day = d.getDay();
  const [o, c] = day === 0 ? [9, 15] : day === 6 ? [8, 17] : [7, 17];
  document.getElementById('openNow').innerHTML = `<i></i> ${h >= o && h < c ? 'Open now' : 'Closed now, back at ' + o + ':00'}`;
  document.getElementById('lcOpen').textContent = h >= o && h < c ? 'Open now' : 'Opens ' + o + ':00';
})();
